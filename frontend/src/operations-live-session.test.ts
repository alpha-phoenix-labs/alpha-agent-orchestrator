import { describe, expect, it } from 'vitest'

import {
  createLiveEventCursor,
  evaluateLiveEvent,
  type LiveEventCursor,
  type LiveEventEnvelope,
  type LiveEventEvaluation,
} from './live-events'
import {
  OperationsLiveClientError,
  type OperationsSnapshotRead,
  type OperationsSnapshotTransport,
  type OperationsStreamResult,
} from './operations-live-client'
import { OperationsLiveSession, type OperationsLiveSessionState } from './operations-live-session'

function field(value: unknown) {
  return {
    source_class: 'AUTHORITATIVE',
    available: true,
    value,
    reason: null,
  }
}

function transport(sequence: number, stateVersion: string): OperationsSnapshotTransport {
  return {
    schema_version: 1,
    state_version: stateVersion,
    event_sequence: sequence,
    contracts: [
      {
        contract: 'SYSTEM_STATE',
        fields: {
          mode: field('SHADOW'),
          writes_enabled: field(false),
          state_version: field(stateVersion),
        },
      },
    ],
  }
}

function read(sequence: number, stateVersion: string): OperationsSnapshotRead {
  return {
    snapshot: transport(sequence, stateVersion),
    cursor: createLiveEventCursor(sequence, stateVersion),
  }
}

function event(sequence: number, base: string, stateVersion: string): LiveEventEnvelope {
  return {
    schema_version: 1,
    event_id: `event-${sequence}`,
    sequence,
    base_state_version: base,
    state_version: stateVersion,
    emitted_at: '2026-09-18T00:00:00+00:00',
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

describe('OperationsLiveSession', () => {
  it('automatically reconnects with bounded scheduling, resyncs a sequence gap, and fails closed on unavailable authority', async () => {
    const states: OperationsLiveSessionState[] = []
    const delays: number[] = []
    let snapshotRead = 0
    let streamRead = 0

    const client = {
      async fetchSnapshot(): Promise<OperationsSnapshotRead> {
        snapshotRead += 1
        if (snapshotRead === 1) return read(0, 'state-v1')
        if (snapshotRead === 2) return read(1, 'state-v2')
        if (snapshotRead === 3) return read(3, 'state-v3')
        throw new OperationsLiveClientError('SNAPSHOT_HTTP_ERROR', 503)
      },
      async consumeEvents(
        cursor: LiveEventCursor,
        onEvaluation: (evaluation: LiveEventEvaluation) => void,
      ): Promise<OperationsStreamResult> {
        streamRead += 1
        if (streamRead === 1) {
          onEvaluation(evaluateLiveEvent(cursor, event(1, 'state-v1', 'state-v2')))
          throw new OperationsLiveClientError('SSE_STREAM_ENDED')
        }
        if (streamRead === 2) {
          const evaluation = evaluateLiveEvent(cursor, event(3, 'state-v2', 'state-v3'))
          onEvaluation(evaluation)
          return { reason: 'RESYNC_REQUIRED', cursor }
        }
        throw new OperationsLiveClientError('SSE_STREAM_ENDED')
      },
    }

    const session = new OperationsLiveSession({
      client,
      onState: (state) => states.push(state),
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      backoffPolicy: { baseDelayMs: 5, maxDelayMs: 20 },
    })

    await session.run(new AbortController().signal)

    expect(delays).toEqual([5, 5])
    expect(states.some((state) => state.resilience.connectionStatus === 'RECONNECT_WAIT')).toBe(true)
    expect(states.some((state) => state.resilience.connectionStatus === 'CONNECTING')).toBe(true)
    expect(states.some((state) => state.resilience.snapshotStatus === 'RESYNC_REQUIRED')).toBe(true)
    expect(states.some((state) => state.transportSnapshot?.state_version === 'state-v3')).toBe(true)
    expect(session.state.resilience.connectionStatus).toBe('UNAVAILABLE')
    expect(session.state.resilience.snapshotStatus).toBe('STALE')
    expect(session.state.snapshot).not.toBeNull()
  })

  it('applies the typed SYSTEM_STATE event before retaining current authority', async () => {
    const states: OperationsLiveSessionState[] = []
    const abort = new AbortController()
    const client = {
      async fetchSnapshot(): Promise<OperationsSnapshotRead> {
        return read(0, 'state-v1')
      },
      async consumeEvents(
        cursor: LiveEventCursor,
        onEvaluation: (evaluation: LiveEventEvaluation) => void,
      ): Promise<OperationsStreamResult> {
        onEvaluation(evaluateLiveEvent(cursor, event(1, 'state-v1', 'state-v2')))
        abort.abort()
        return {
          reason: 'ABORTED',
          cursor: createLiveEventCursor(1, 'state-v2'),
        }
      },
    }

    const session = new OperationsLiveSession({
      client,
      onState: (state) => states.push(state),
    })

    await session.run(abort.signal)

    const updated = states.find((state) => state.transportSnapshot?.event_sequence === 1)
    expect(updated?.transportSnapshot?.state_version).toBe('state-v2')
    expect(updated?.resilience.snapshotStatus).toBe('CURRENT')
    expect(updated?.snapshot?.systemState?.fields.state_version.value).toBe('state-v2')
    expect(updated?.recentEvents).toEqual([
      {
        sequence: 1,
        emittedAt: '2026-09-18T00:00:00+00:00',
        eventType: 'VIEW_CONTRACT_SYSTEM_STATE',
        stateVersion: 'state-v2',
        contract: 'SYSTEM_STATE',
        sourceClass: 'AUTHORITATIVE',
      },
    ])
  })

  it('preserves RESYNC_REQUIRED when authoritative snapshot resync fails', async () => {
    let snapshotRead = 0
    const client = {
      async fetchSnapshot(): Promise<OperationsSnapshotRead> {
        snapshotRead += 1
        if (snapshotRead === 1) return read(0, 'state-v1')
        throw new OperationsLiveClientError('SNAPSHOT_HTTP_ERROR', 503)
      },
      async consumeEvents(
        cursor: LiveEventCursor,
        onEvaluation: (evaluation: LiveEventEvaluation) => void,
      ): Promise<OperationsStreamResult> {
        const evaluation = evaluateLiveEvent(cursor, event(2, 'state-v1', 'state-v2'))
        onEvaluation(evaluation)
        return { reason: 'RESYNC_REQUIRED', cursor }
      },
    }

    const session = new OperationsLiveSession({
      client,
      onState: () => undefined,
    })

    await session.run(new AbortController().signal)

    expect(session.state.resilience.connectionStatus).toBe('UNAVAILABLE')
    expect(session.state.resilience.snapshotStatus).toBe('RESYNC_REQUIRED')
    expect(session.state.resilience.reason).toBe('SNAPSHOT_HTTP_ERROR')
  })
})
