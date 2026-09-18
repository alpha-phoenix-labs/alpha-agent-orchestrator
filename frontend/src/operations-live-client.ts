import {
  createLiveEventCursor,
  evaluateLiveEvent,
  parseLiveEvent,
  type LiveEventCursor,
  type LiveEventEnvelope,
  type LiveEventEvaluation,
} from './live-events'

export const OPERATIONS_SNAPSHOT_PATH = '/v1/operations/snapshot'
export const OPERATIONS_EVENTS_PATH = '/v1/operations/events'
export const OPERATIONS_SNAPSHOT_SCHEMA_VERSION = 1 as const

export type OperationsSnapshotTransport = Readonly<{
  schema_version: typeof OPERATIONS_SNAPSHOT_SCHEMA_VERSION
  state_version: string
  event_sequence: number
  contracts: unknown[]
}>

export type OperationsSnapshotRead = Readonly<{
  snapshot: OperationsSnapshotTransport
  cursor: LiveEventCursor
}>

export type OperationsStreamResult = Readonly<{
  reason: 'ABORTED' | 'RESYNC_REQUIRED'
  cursor: LiveEventCursor
}>

export class OperationsLiveClientError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null = null) {
    super(code)
    this.name = 'OperationsLiveClientError'
    this.code = code
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum
}

const snapshotFields = new Set([
  'schema_version',
  'state_version',
  'event_sequence',
  'contracts',
])

export function parseOperationsSnapshotTransport(value: unknown): OperationsSnapshotTransport {
  if (!isRecord(value)) {
    throw new OperationsLiveClientError('SNAPSHOT_MUST_BE_OBJECT')
  }

  const keys = Object.keys(value)
  if (keys.length !== snapshotFields.size || keys.some((key) => !snapshotFields.has(key))) {
    throw new OperationsLiveClientError('INVALID_SNAPSHOT_FIELDS')
  }
  if (value.schema_version !== OPERATIONS_SNAPSHOT_SCHEMA_VERSION) {
    throw new OperationsLiveClientError('UNSUPPORTED_SNAPSHOT_SCHEMA_VERSION')
  }
  if (!isNonEmptyString(value.state_version)) {
    throw new OperationsLiveClientError('INVALID_SNAPSHOT_STATE_VERSION')
  }
  if (!isIntegerAtLeast(value.event_sequence, 0)) {
    throw new OperationsLiveClientError('INVALID_SNAPSHOT_EVENT_SEQUENCE')
  }
  if (!Array.isArray(value.contracts)) {
    throw new OperationsLiveClientError('INVALID_SNAPSHOT_CONTRACTS')
  }

  return {
    schema_version: OPERATIONS_SNAPSHOT_SCHEMA_VERSION,
    state_version: value.state_version,
    event_sequence: value.event_sequence,
    contracts: [...value.contracts],
  }
}

function parseCanonicalSseFrame(frame: string): LiveEventEnvelope {
  if (!frame || frame.includes('\r')) {
    throw new OperationsLiveClientError('INVALID_SSE_FRAME')
  }

  const lines = frame.split('\n')
  if (
    lines.length !== 3 ||
    !lines[0].startsWith('id: ') ||
    !lines[1].startsWith('event: ') ||
    !lines[2].startsWith('data: ')
  ) {
    throw new OperationsLiveClientError('INVALID_SSE_FRAME')
  }

  const eventId = lines[0].slice(4)
  const eventType = lines[1].slice(7)
  if (!eventId || !eventType) {
    throw new OperationsLiveClientError('INVALID_SSE_FRAME')
  }

  let value: unknown
  try {
    value = JSON.parse(lines[2].slice(6))
  } catch {
    throw new OperationsLiveClientError('INVALID_SSE_JSON')
  }

  const parsed = parseLiveEvent(value)
  if (!parsed.ok) {
    throw new OperationsLiveClientError(`INVALID_LIVE_EVENT_${parsed.reason}`)
  }
  if (parsed.event.event_id !== eventId || parsed.event.event_type !== eventType) {
    throw new OperationsLiveClientError('SSE_ENVELOPE_MISMATCH')
  }

  return parsed.event
}

function normalizedContentType(response: Response): string {
  return (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
}

function buildUrl(baseUrl: string, path: string): string {
  if (baseUrl.includes('?') || baseUrl.includes('#')) {
    throw new OperationsLiveClientError('INVALID_OPERATIONS_BASE_URL')
  }
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel()
  } catch {
    // Cancellation is best-effort and must not promote or alter authority state.
  }
}

export class OperationsLiveClient {
  readonly #baseUrl: string
  readonly #authorization: string
  readonly #fetch: typeof fetch

  constructor({
    baseUrl,
    bearerCredential,
    fetchImpl = fetch,
  }: {
    baseUrl: string
    bearerCredential: string
    fetchImpl?: typeof fetch
  }) {
    if (
      !bearerCredential ||
      bearerCredential.includes('\r') ||
      bearerCredential.includes('\n')
    ) {
      throw new OperationsLiveClientError('INVALID_PREVIEW_BEARER_CREDENTIAL')
    }
    buildUrl(baseUrl, OPERATIONS_SNAPSHOT_PATH)
    this.#baseUrl = baseUrl
    this.#authorization = `Bearer ${bearerCredential}`
    this.#fetch = fetchImpl.bind(globalThis)
  }

  async #request(
    path: string,
    accept: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    try {
      return await this.#fetch(buildUrl(this.#baseUrl, path), {
        method: 'GET',
        headers: {
          Accept: accept,
          Authorization: this.#authorization,
        },
        cache: 'no-store',
        signal,
      })
    } catch {
      throw new OperationsLiveClientError('OPERATIONS_NETWORK_REQUEST_FAILED')
    }
  }

  async fetchSnapshot(signal?: AbortSignal): Promise<OperationsSnapshotRead> {
    const response = await this.#request(OPERATIONS_SNAPSHOT_PATH, 'application/json', signal)
    if (response.status === 401 || response.status === 403) {
      throw new OperationsLiveClientError('SNAPSHOT_UNAUTHORIZED', response.status)
    }
    if (!response.ok) {
      throw new OperationsLiveClientError('SNAPSHOT_HTTP_ERROR', response.status)
    }
    if (normalizedContentType(response) !== 'application/json') {
      throw new OperationsLiveClientError('SNAPSHOT_CONTENT_TYPE_INVALID', response.status)
    }

    let value: unknown
    try {
      value = await response.json()
    } catch {
      throw new OperationsLiveClientError('SNAPSHOT_JSON_INVALID', response.status)
    }

    const snapshot = parseOperationsSnapshotTransport(value)
    return {
      snapshot,
      cursor: createLiveEventCursor(snapshot.event_sequence, snapshot.state_version),
    }
  }

  async consumeEvents(
    cursor: LiveEventCursor,
    onEvaluation: (evaluation: LiveEventEvaluation) => void,
    signal?: AbortSignal,
  ): Promise<OperationsStreamResult> {
    const response = await this.#request(OPERATIONS_EVENTS_PATH, 'text/event-stream', signal)
    if (response.status === 401 || response.status === 403) {
      throw new OperationsLiveClientError('SSE_UNAUTHORIZED', response.status)
    }
    if (!response.ok) {
      throw new OperationsLiveClientError('SSE_HTTP_ERROR', response.status)
    }
    if (normalizedContentType(response) !== 'text/event-stream') {
      throw new OperationsLiveClientError('SSE_CONTENT_TYPE_INVALID', response.status)
    }
    if (!response.body) {
      throw new OperationsLiveClientError('SSE_BODY_UNAVAILABLE', response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentCursor = cursor

    try {
      while (true) {
        if (signal?.aborted) {
          await cancelReader(reader)
          return { reason: 'ABORTED', cursor: currentCursor }
        }

        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const event = parseCanonicalSseFrame(frame)
          const evaluation = evaluateLiveEvent(currentCursor, event)
          onEvaluation(evaluation)

          if (evaluation.decision === 'RESYNC_REQUIRED') {
            await cancelReader(reader)
            return { reason: 'RESYNC_REQUIRED', cursor: currentCursor }
          }
          if (evaluation.decision === 'ACCEPTED') {
            currentCursor = evaluation.cursor
          }
          if (signal?.aborted) {
            await cancelReader(reader)
            return { reason: 'ABORTED', cursor: currentCursor }
          }

          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (error instanceof OperationsLiveClientError) throw error
      if (signal?.aborted) {
        return { reason: 'ABORTED', cursor: currentCursor }
      }
      throw new OperationsLiveClientError('SSE_STREAM_READ_FAILED')
    }

    buffer += decoder.decode()
    if (buffer.length > 0) {
      throw new OperationsLiveClientError('SSE_TRUNCATED_FRAME')
    }
    if (signal?.aborted) {
      return { reason: 'ABORTED', cursor: currentCursor }
    }
    throw new OperationsLiveClientError('SSE_STREAM_ENDED')
  }
}
