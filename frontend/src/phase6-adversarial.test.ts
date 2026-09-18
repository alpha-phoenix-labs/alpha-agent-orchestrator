import { describe, expect, it, vi } from 'vitest'

import {
  connectionAuthorityAvailable,
  createConnectionResilienceState,
  markConnectionConnected,
  markConnectionUnavailable,
  markSnapshotResynced,
} from './connection-resilience'
import {
  createLiveEventCursor,
  evaluateLiveEvent,
  type LiveEventEnvelope,
} from './live-events'
import {
  applySystemStateEventToTransport,
  mapOperationsSnapshotTransport,
} from './operations-snapshot-model'
import {
  Phase5ControlClient,
  Phase5ControlClientError,
} from './phase5-control-client'
import type { OperationsSnapshotTransport } from './operations-live-client'

function field(sourceClass: string, value: unknown) {
  return {
    source_class: sourceClass,
    available: true,
    value,
    reason: null,
  }
}

function authorityTransport(): OperationsSnapshotTransport {
  return {
    schema_version: 1,
    state_version: 'state-v1',
    event_sequence: 0,
    contracts: [
      {
        contract: 'SYSTEM_STATE',
        fields: {
          mode: field('AUTHORITATIVE', 'SHADOW'),
          writes_enabled: field('AUTHORITATIVE', false),
          state_version: field('AUTHORITATIVE', 'state-v1'),
        },
      },
      {
        contract: 'TELEMETRY',
        fields: {
          metrics: field('TELEMETRY', { writer_ready: true, writes_enabled: true }),
          observed_at: field('TELEMETRY', '2026-09-18T09:00:00+00:00'),
        },
      },
      {
        contract: 'AGENT',
        fields: {
          agent_id: field('AUTHORITATIVE', 'agent-self-claim'),
          role: field('AUTHORITATIVE', 'leader'),
          self_reported_write_eligible: field('TELEMETRY', true),
        },
      },
    ],
  }
}

function event(overrides: Partial<LiveEventEnvelope> = {}): LiveEventEnvelope {
  return {
    schema_version: 1,
    event_id: 'evt-phase6',
    sequence: 11,
    base_state_version: 'state-v7',
    state_version: 'state-v8',
    emitted_at: '2026-09-18T09:00:00+00:00',
    event_type: 'VIEW_CONTRACT_SYSTEM_STATE',
    payload: {
      contract: 'SYSTEM_STATE',
      source_class: 'AUTHORITATIVE',
      mode: 'SHADOW',
      writes_enabled: false,
      state_version: 'state-v8',
    },
    ...overrides,
  }
}

describe('Phase 6 frontend adversarial authority boundaries', () => {
  it('never promotes telemetry or agent self-claims into writer authority', () => {
    const snapshot = mapOperationsSnapshotTransport(authorityTransport())

    expect(snapshot.systemState?.fields.mode.value).toBe('SHADOW')
    expect(snapshot.systemState?.fields.writes_enabled.value).toBe(false)
    expect(snapshot.writer).toBeUndefined()
    expect(snapshot.activeWorkOrder).toBeUndefined()
    expect(snapshot.leader).toBeUndefined()
    expect(snapshot.telemetry?.fields.metrics.value).toEqual({
      writer_ready: true,
      writes_enabled: true,
    })
  })

  it('rejects a telemetry-sourced event that attempts to mutate authoritative system state', () => {
    const malicious = event({
      payload: {
        contract: 'SYSTEM_STATE',
        source_class: 'TELEMETRY',
        mode: 'LIVE_GATED',
        writes_enabled: true,
        state_version: 'state-v8',
      },
    })

    expect(() => applySystemStateEventToTransport(authorityTransport(), malicious)).toThrow(
      'UNSUPPORTED_LIVE_EVENT_FOR_SNAPSHOT',
    )
    const snapshot = mapOperationsSnapshotTransport(authorityTransport())
    expect(snapshot.systemState?.fields.mode.value).toBe('SHADOW')
    expect(snapshot.systemState?.fields.writes_enabled.value).toBe(false)
  })

  it.each([
    [event({ event_id: 'duplicate', sequence: 12 }), new Set(['duplicate']), 'DUPLICATE'],
    [event({ event_id: 'old', sequence: 9 }), new Set<string>(), 'RESYNC_REQUIRED'],
    [event({ event_id: 'gap', sequence: 13 }), new Set<string>(), 'RESYNC_REQUIRED'],
    [
      event({
        event_id: 'drift',
        sequence: 11,
        base_state_version: 'state-v6',
      }),
      new Set<string>(),
      'RESYNC_REQUIRED',
    ],
  ])('does not advance authority for duplicate/stale/gap/drift event %#', (candidate, seen, decision) => {
    const cursor = createLiveEventCursor(10, 'state-v7', seen)
    const result = evaluateLiveEvent(cursor, candidate)
    expect(result.decision).toBe(decision)
    expect(result.cursor).toBe(cursor)
  })

  it('treats malformed live input as non-authoritative and leaves the cursor unchanged', () => {
    const cursor = createLiveEventCursor(10, 'state-v7')
    const result = evaluateLiveEvent(cursor, {
      schema_version: 1,
      event_id: 'malformed',
      sequence: 11,
      base_state_version: 'state-v7',
      state_version: 'state-v8',
      emitted_at: 'not-a-timestamp',
      event_type: 'VIEW_CONTRACT_SYSTEM_STATE',
      payload: {},
    })
    expect(result.decision).toBe('INVALID')
    expect(result.cursor).toBe(cursor)
    expect(result.event).toBeNull()
  })

  it('reports authority unavailable unless connection is connected and snapshot is current', () => {
    const initial = createConnectionResilienceState('NOT_REQUIRED')
    expect(connectionAuthorityAvailable(initial)).toBe(false)

    const connected = markConnectionConnected(initial)
    expect(connectionAuthorityAvailable(connected)).toBe(false)

    const current = markSnapshotResynced(connected)
    expect(connectionAuthorityAvailable(current)).toBe(true)

    const unavailable = markConnectionUnavailable(current, 'CONTROL_PLANE_OUTAGE')
    expect(connectionAuthorityAvailable(unavailable)).toBe(false)
    expect(unavailable.snapshotStatus).toBe('STALE')
  })

  it('fails closed when the Phase-5 control plane is unreachable', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch

    try {
      const client = new Phase5ControlClient({ bearerCredential: 'phase6-test' })
      await expect(client.fetchState()).rejects.toEqual(
        expect.objectContaining<Partial<Phase5ControlClientError>>({
          code: 'PHASE5_CONTROL_NETWORK_FAILED',
        }),
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
