import { describe, expect, it } from 'vitest'

import { type LiveEventEnvelope } from './live-events'
import type { OperationsSnapshotTransport } from './operations-live-client'
import {
  applySystemStateEventToTransport,
  mapOperationsSnapshotTransport,
} from './operations-snapshot-model'

function field(source_class: string, value: unknown) {
  return { source_class, available: true, value, reason: null }
}

function transport(): OperationsSnapshotTransport {
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
        contract: 'CANONICAL_STATE',
        fields: {
          repository: { source_class: 'AUTHORITATIVE', available: false, value: null, reason: 'NOT_WIRED' },
        },
      },
      {
        contract: 'AGENT',
        fields: {
          agent_id: { source_class: 'AUTHORITATIVE', available: false, value: null, reason: 'NOT_WIRED' },
        },
      },
    ],
  }
}

describe('Operations snapshot model adapter', () => {
  it('maps backend contracts without inventing active work order or leader authority', () => {
    const model = mapOperationsSnapshotTransport(transport())

    expect(model.systemState?.fields.mode.value).toBe('SHADOW')
    expect(model.canonicalState).toBeDefined()
    expect(model.agents).toHaveLength(1)
    expect(model.activeWorkOrder).toBeUndefined()
    expect(model.leader).toBeUndefined()
  })

  it('applies the only currently supported typed live event to snapshot continuity', () => {
    const event: LiveEventEnvelope = {
      schema_version: 1,
      event_id: 'event-1',
      sequence: 1,
      base_state_version: 'state-v1',
      state_version: 'state-v2',
      emitted_at: '2026-09-18T00:00:00+00:00',
      event_type: 'VIEW_CONTRACT_SYSTEM_STATE',
      payload: {
        contract: 'SYSTEM_STATE',
        source_class: 'AUTHORITATIVE',
        mode: 'SHADOW',
        writes_enabled: false,
        state_version: 'state-v2',
      },
    }

    const next = applySystemStateEventToTransport(transport(), event)
    const model = mapOperationsSnapshotTransport(next)

    expect(next.event_sequence).toBe(1)
    expect(next.state_version).toBe('state-v2')
    expect(model.systemState?.fields.state_version.value).toBe('state-v2')
  })

  it('rejects unsupported live event payloads instead of guessing snapshot state', () => {
    const event: LiveEventEnvelope = {
      schema_version: 1,
      event_id: 'event-1',
      sequence: 1,
      base_state_version: 'state-v1',
      state_version: 'state-v2',
      emitted_at: '2026-09-18T00:00:00+00:00',
      event_type: 'WORK_ORDER_UPDATED',
      payload: { contract: 'WORK_ORDER' },
    }

    expect(() => applySystemStateEventToTransport(transport(), event)).toThrow(
      'UNSUPPORTED_LIVE_EVENT_FOR_SNAPSHOT',
    )
  })
})
