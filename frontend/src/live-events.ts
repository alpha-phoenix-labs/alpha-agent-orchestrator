export const LIVE_EVENT_SCHEMA_VERSION = 1 as const

export type LiveEventDecision = 'ACCEPTED' | 'DUPLICATE' | 'RESYNC_REQUIRED' | 'INVALID'

export type LiveEventEnvelope = {
  schema_version: typeof LIVE_EVENT_SCHEMA_VERSION
  event_id: string
  sequence: number
  base_state_version: string
  state_version: string
  emitted_at: string
  event_type: string
  payload: Record<string, unknown>
}

export type RecentLiveEvent = Readonly<{
  sequence: number
  emittedAt: string
  eventType: string
  stateVersion: string
  contract: string | null
  sourceClass: string | null
}>

export function projectRecentLiveEvent(event: LiveEventEnvelope): RecentLiveEvent {
  return {
    sequence: event.sequence,
    emittedAt: event.emitted_at,
    eventType: event.event_type,
    stateVersion: event.state_version,
    contract: typeof event.payload.contract === 'string' ? event.payload.contract : null,
    sourceClass: typeof event.payload.source_class === 'string' ? event.payload.source_class : null,
  }
}

export type LiveEventCursor = {
  lastSequence: number
  currentStateVersion: string
  seenEventIds: ReadonlySet<string>
}

export type LiveEventParseResult =
  | { ok: true; event: LiveEventEnvelope }
  | { ok: false; reason: string }

export type LiveEventEvaluation = {
  decision: LiveEventDecision
  reason: string
  cursor: LiveEventCursor
  event: LiveEventEnvelope | null
}

const expectedFields = new Set([
  'schema_version',
  'event_id',
  'sequence',
  'base_state_version',
  'state_version',
  'emitted_at',
  'event_type',
  'payload',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOffsetTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return false
  }

  return Number.isFinite(Date.parse(value))
}

export function createLiveEventCursor(
  lastSequence: number,
  currentStateVersion: string,
  seenEventIds: ReadonlySet<string> = new Set(),
): LiveEventCursor {
  if (!isIntegerAtLeast(lastSequence, 0)) {
    throw new Error('INVALID_CURSOR_SEQUENCE')
  }
  if (!isNonEmptyString(currentStateVersion)) {
    throw new Error('INVALID_CURSOR_STATE_VERSION')
  }

  return {
    lastSequence,
    currentStateVersion,
    seenEventIds: new Set(seenEventIds),
  }
}

export function parseLiveEvent(value: unknown): LiveEventParseResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'EVENT_MUST_BE_OBJECT' }
  }

  const keys = Object.keys(value)
  if (keys.length !== expectedFields.size || keys.some((key) => !expectedFields.has(key))) {
    return { ok: false, reason: 'INVALID_EVENT_FIELDS' }
  }

  if (!isIntegerAtLeast(value.schema_version, 1)) {
    return { ok: false, reason: 'INVALID_SCHEMA_VERSION' }
  }
  if (value.schema_version !== LIVE_EVENT_SCHEMA_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_SCHEMA_VERSION' }
  }
  if (!isNonEmptyString(value.event_id)) {
    return { ok: false, reason: 'INVALID_EVENT_ID' }
  }
  if (!isIntegerAtLeast(value.sequence, 1)) {
    return { ok: false, reason: 'INVALID_SEQUENCE' }
  }
  if (!isNonEmptyString(value.base_state_version)) {
    return { ok: false, reason: 'INVALID_BASE_STATE_VERSION' }
  }
  if (!isNonEmptyString(value.state_version)) {
    return { ok: false, reason: 'INVALID_STATE_VERSION' }
  }
  if (!isOffsetTimestamp(value.emitted_at)) {
    return { ok: false, reason: 'INVALID_EMITTED_AT' }
  }
  if (!isNonEmptyString(value.event_type)) {
    return { ok: false, reason: 'INVALID_EVENT_TYPE' }
  }
  if (!isRecord(value.payload)) {
    return { ok: false, reason: 'INVALID_PAYLOAD' }
  }

  return {
    ok: true,
    event: {
      schema_version: LIVE_EVENT_SCHEMA_VERSION,
      event_id: value.event_id,
      sequence: value.sequence,
      base_state_version: value.base_state_version,
      state_version: value.state_version,
      emitted_at: value.emitted_at,
      event_type: value.event_type,
      payload: { ...value.payload },
    },
  }
}

export function evaluateLiveEvent(
  cursor: LiveEventCursor,
  value: unknown,
): LiveEventEvaluation {
  const parsed = parseLiveEvent(value)
  if (!parsed.ok) {
    return {
      decision: 'INVALID',
      reason: parsed.reason,
      cursor,
      event: null,
    }
  }

  const { event } = parsed
  if (cursor.seenEventIds.has(event.event_id)) {
    return {
      decision: 'DUPLICATE',
      reason: 'DUPLICATE_EVENT_ID',
      cursor,
      event,
    }
  }

  if (event.sequence === cursor.lastSequence) {
    return {
      decision: 'RESYNC_REQUIRED',
      reason: 'SEQUENCE_COLLISION',
      cursor,
      event,
    }
  }

  if (event.sequence < cursor.lastSequence) {
    return {
      decision: 'RESYNC_REQUIRED',
      reason: 'STALE_OR_OUT_OF_ORDER_SEQUENCE',
      cursor,
      event,
    }
  }

  const expectedSequence = cursor.lastSequence + 1
  if (event.sequence > expectedSequence) {
    return {
      decision: 'RESYNC_REQUIRED',
      reason: 'MISSING_SEQUENCE',
      cursor,
      event,
    }
  }

  if (event.base_state_version !== cursor.currentStateVersion) {
    return {
      decision: 'RESYNC_REQUIRED',
      reason: 'STATE_VERSION_DRIFT',
      cursor,
      event,
    }
  }

  return {
    decision: 'ACCEPTED',
    reason: 'ACCEPTED',
    cursor: createLiveEventCursor(
      event.sequence,
      event.state_version,
      new Set([...cursor.seenEventIds, event.event_id]),
    ),
    event,
  }
}
