import { describe, expect, it } from 'vitest'

import {
  createLiveEventCursor,
  evaluateLiveEvent,
  LIVE_EVENT_SCHEMA_VERSION,
  parseLiveEvent,
} from './live-events'

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: LIVE_EVENT_SCHEMA_VERSION,
    event_id: 'evt-1',
    sequence: 11,
    base_state_version: 7,
    state_version: 8,
    emitted_at: '2026-09-17T00:30:00+00:00',
    event_type: 'WORK_ORDER_UPDATED',
    payload: { contract: 'WORK_ORDER' },
    ...overrides,
  }
}

describe('Phase 4.11 live event schema safety', () => {
  it('parses the transport-neutral canonical envelope', () => {
    expect(parseLiveEvent(eventPayload())).toEqual({
      ok: true,
      event: eventPayload(),
    })
  })

  it.each([
    [{ schema_version: 2 }, 'UNSUPPORTED_SCHEMA_VERSION'],
    [{ event_id: '' }, 'INVALID_EVENT_ID'],
    [{ sequence: 0 }, 'INVALID_SEQUENCE'],
    [{ sequence: 1.5 }, 'INVALID_SEQUENCE'],
    [{ base_state_version: -1 }, 'INVALID_BASE_STATE_VERSION'],
    [{ state_version: -1 }, 'INVALID_STATE_VERSION'],
    [{ base_state_version: 9, state_version: 8 }, 'STATE_VERSION_BEFORE_BASE'],
    [{ emitted_at: '2026-09-17T00:30:00' }, 'INVALID_EMITTED_AT'],
    [{ event_type: '   ' }, 'INVALID_EVENT_TYPE'],
    [{ payload: [] }, 'INVALID_PAYLOAD'],
  ])('rejects schema-incompatible values %#', (changes, reason) => {
    expect(parseLiveEvent(eventPayload(changes))).toEqual({ ok: false, reason })
  })

  it('rejects missing and extra envelope fields', () => {
    const missing = eventPayload()
    delete (missing as Partial<typeof missing>).event_type

    expect(parseLiveEvent(missing)).toEqual({
      ok: false,
      reason: 'INVALID_EVENT_FIELDS',
    })
    expect(parseLiveEvent(eventPayload({ extra_field: 'nope' }))).toEqual({
      ok: false,
      reason: 'INVALID_EVENT_FIELDS',
    })
  })

  it('accepts only a contiguous event matching the current state version', () => {
    const baseline = createLiveEventCursor(10, 7)
    const result = evaluateLiveEvent(baseline, eventPayload())

    expect(result.decision).toBe('ACCEPTED')
    expect(result.reason).toBe('ACCEPTED')
    expect(result.cursor.lastSequence).toBe(11)
    expect(result.cursor.currentStateVersion).toBe(8)
    expect([...result.cursor.seenEventIds]).toEqual(['evt-1'])
  })

  it('ignores a duplicate event id without advancing the cursor', () => {
    const baseline = createLiveEventCursor(11, 8, new Set(['evt-1']))
    const result = evaluateLiveEvent(
      baseline,
      eventPayload({ sequence: 12, base_state_version: 8, state_version: 9 }),
    )

    expect(result.decision).toBe('DUPLICATE')
    expect(result.reason).toBe('DUPLICATE_EVENT_ID')
    expect(result.cursor).toBe(baseline)
  })

  it.each([
    [{ event_id: 'evt-collision', sequence: 10 }, 'SEQUENCE_COLLISION'],
    [{ event_id: 'evt-old', sequence: 9 }, 'STALE_OR_OUT_OF_ORDER_SEQUENCE'],
    [{ event_id: 'evt-gap', sequence: 12 }, 'MISSING_SEQUENCE'],
    [
      { event_id: 'evt-drift', sequence: 11, base_state_version: 6, state_version: 8 },
      'STATE_VERSION_DRIFT',
    ],
  ])('requires resync for order/state drift %#', (changes, reason) => {
    const baseline = createLiveEventCursor(10, 7)
    const result = evaluateLiveEvent(baseline, eventPayload(changes))

    expect(result.decision).toBe('RESYNC_REQUIRED')
    expect(result.reason).toBe(reason)
    expect(result.cursor).toBe(baseline)
  })

  it('rejects malformed input without allowing authoritative state mutation', () => {
    const baseline = createLiveEventCursor(10, 7)
    const result = evaluateLiveEvent(baseline, { schema_version: 1 })

    expect(result.decision).toBe('INVALID')
    expect(result.reason).toBe('INVALID_EVENT_FIELDS')
    expect(result.cursor).toBe(baseline)
    expect(result.event).toBeNull()
  })

  it.each([
    [-1, 0, 'INVALID_CURSOR_SEQUENCE'],
    [0, -1, 'INVALID_CURSOR_STATE_VERSION'],
  ])('requires an authoritative non-negative baseline %#', (sequence, stateVersion, reason) => {
    expect(() => createLiveEventCursor(sequence, stateVersion)).toThrow(reason)
  })
})
