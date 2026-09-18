import { describe, expect, it } from 'vitest'

import {
  applyLiveEventEvaluation,
  connectionAuthorityAvailable,
  createConnectionResilienceState,
  markConnectionConnected,
  markConnectionLost,
  markConnectionUnavailable,
  markSnapshotResynced,
} from './connection-resilience'
import { createLiveEventCursor, type LiveEventEvaluation } from './live-events'
import {
  OPERATIONS_EVENTS_PATH,
  OPERATIONS_SNAPSHOT_PATH,
  OperationsLiveClient,
  OperationsLiveClientError,
  parseOperationsSnapshotTransport,
} from './operations-live-client'

function snapshotBody(sequence = 7, stateVersion = 'state-v1') {
  return {
    schema_version: 1,
    state_version: stateVersion,
    event_sequence: sequence,
    contracts: [],
  }
}

function eventValue({
  sequence = 8,
  base = 'state-v1',
  stateVersion = 'state-v2',
}: {
  sequence?: number
  base?: string
  stateVersion?: string
} = {}) {
  return {
    schema_version: 1,
    event_id: `evt-${sequence}`,
    sequence,
    base_state_version: base,
    state_version: stateVersion,
    emitted_at: '2026-09-17T20:30:00+00:00',
    event_type: 'VIEW_CONTRACT_SYSTEM_STATE',
    payload: {
      contract: 'SYSTEM_STATE',
      source_class: 'AUTHORITATIVE',
      mode: 'SHADOW',
      writes_enabled: false,
      state_version: stateVersion,
    },
  }
}

function eventFrame(value = eventValue()): string {
  return [
    `id: ${value.event_id}`,
    `event: ${value.event_type}`,
    `data: ${JSON.stringify(value)}`,
    '',
    '',
  ].join('\n')
}

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  })
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

describe('OperationsLiveClient', () => {
  it('uses the same in-memory bearer for snapshot and fetch-based SSE', async () => {
    const requests: Array<{ url: string; authorization: string | null }> = []
    let call = 0
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('Authorization'),
      })
      call += 1
      if (call === 1) return jsonResponse(snapshotBody())
      return streamResponse([eventFrame().slice(0, 41), eventFrame().slice(41)])
    }) as typeof fetch

    const client = new OperationsLiveClient({
      baseUrl: 'https://preview.example.test',
      bearerCredential: 'preview-test-token',
      fetchImpl,
    })
    const read = await client.fetchSnapshot()
    const evaluations: LiveEventEvaluation[] = []
    const abort = new AbortController()
    const result = await client.consumeEvents(
      read.cursor,
      (evaluation) => {
        evaluations.push(evaluation)
        abort.abort()
      },
      abort.signal,
    )

    expect(read.snapshot.event_sequence).toBe(7)
    expect(read.cursor.currentStateVersion).toBe('state-v1')
    expect(evaluations.map((entry) => entry.decision)).toEqual(['ACCEPTED'])
    expect(result.reason).toBe('ABORTED')
    expect(result.cursor.lastSequence).toBe(8)
    expect(requests).toEqual([
      {
        url: `https://preview.example.test${OPERATIONS_SNAPSHOT_PATH}`,
        authorization: 'Bearer preview-test-token',
      },
      {
        url: `https://preview.example.test${OPERATIONS_EVENTS_PATH}`,
        authorization: 'Bearer preview-test-token',
      },
    ])
  })

  it('turns a sequence gap into RESYNC_REQUIRED without advancing the cursor', async () => {
    const fetchImpl = (async () =>
      streamResponse([eventFrame(eventValue({ sequence: 9 }))])) as typeof fetch
    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: 'preview-test-token',
      fetchImpl,
    })
    const cursor = createLiveEventCursor(7, 'state-v1')
    const evaluations: LiveEventEvaluation[] = []

    const result = await client.consumeEvents(cursor, (evaluation) => {
      evaluations.push(evaluation)
    })

    expect(result.reason).toBe('RESYNC_REQUIRED')
    expect(result.cursor).toBe(cursor)
    expect(evaluations).toHaveLength(1)
    expect(evaluations[0].decision).toBe('RESYNC_REQUIRED')
    expect(evaluations[0].reason).toBe('MISSING_SEQUENCE')

    let resilience = markConnectionConnected(createConnectionResilienceState())
    resilience = markSnapshotResynced(resilience)
    resilience = applyLiveEventEvaluation(resilience, evaluations[0])
    expect(resilience.snapshotStatus).toBe('RESYNC_REQUIRED')
    expect(connectionAuthorityAvailable(resilience)).toBe(false)
  })

  it('treats unexpected stream end as disconnect and retained snapshot as STALE', async () => {
    const fetchImpl = (async () => streamResponse([])) as typeof fetch
    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: 'preview-test-token',
      fetchImpl,
    })

    await expect(
      client.consumeEvents(createLiveEventCursor(7, 'state-v1'), () => undefined),
    ).rejects.toMatchObject({ code: 'SSE_STREAM_ENDED' })

    let resilience = markConnectionConnected(createConnectionResilienceState())
    resilience = markSnapshotResynced(resilience)
    resilience = markConnectionLost(resilience, 'SSE_STREAM_ENDED')
    expect(resilience.connectionStatus).toBe('RECONNECT_WAIT')
    expect(resilience.snapshotStatus).toBe('STALE')
    expect(connectionAuthorityAvailable(resilience)).toBe(false)
  })

  it('treats authorization loss as UNAVAILABLE without exposing the credential', async () => {
    const fetchImpl = (async () =>
      new Response('', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch
    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: 'preview-test-token',
      fetchImpl,
    })

    let captured: unknown
    try {
      await client.consumeEvents(createLiveEventCursor(7, 'state-v1'), () => undefined)
    } catch (error) {
      captured = error
    }

    expect(captured).toBeInstanceOf(OperationsLiveClientError)
    expect(captured).toMatchObject({ code: 'SSE_UNAUTHORIZED', status: 401 })
    expect(String(captured)).not.toContain('preview-test-token')

    let resilience = markConnectionConnected(createConnectionResilienceState())
    resilience = markSnapshotResynced(resilience)
    resilience = markConnectionUnavailable(resilience, 'SSE_UNAUTHORIZED')
    expect(resilience.connectionStatus).toBe('UNAVAILABLE')
    expect(resilience.snapshotStatus).toBe('STALE')
    expect(connectionAuthorityAvailable(resilience)).toBe(false)
  })

  it('rejects malformed snapshot continuity metadata and noncanonical SSE framing', async () => {
    expect(() =>
      parseOperationsSnapshotTransport({
        ...snapshotBody(),
        event_sequence: -1,
      }),
    ).toThrow('INVALID_SNAPSHOT_EVENT_SEQUENCE')

    const fetchImpl = (async () =>
      streamResponse([eventFrame().replace('\n\n', '\r\n\r\n')])) as typeof fetch
    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: 'preview-test-token',
      fetchImpl,
    })

    await expect(
      client.consumeEvents(createLiveEventCursor(7, 'state-v1'), () => undefined),
    ).rejects.toMatchObject({ code: 'SSE_TRUNCATED_FRAME' })
  })
})
