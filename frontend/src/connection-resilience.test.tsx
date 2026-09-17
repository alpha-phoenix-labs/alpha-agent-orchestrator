import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { routes } from './App'
import {
  applyLiveEventEvaluation,
  connectionAuthorityAvailable,
  createConnectionResilienceState,
  markConnectionConnected,
  markConnectionLost,
  markReconnectAttempt,
  markSnapshotResynced,
  recordHeartbeat,
} from './connection-resilience'
import type { OperationsSnapshot, ViewContract, ViewField } from './contracts'
import { I18nProvider } from './i18n'
import { createLiveEventCursor, evaluateLiveEvent } from './live-events'
import { OperationsDataProvider, useOperationsData } from './operations-data'

afterEach(cleanup)

function field<T>(value: T): ViewField<T> {
  return {
    source_class: 'AUTHORITATIVE',
    available: true,
    value,
    reason: null,
  }
}

function contract(name: string, fields: Record<string, ViewField>): ViewContract {
  return { contract: name, fields }
}

const snapshot: OperationsSnapshot = {
  systemState: contract('SYSTEM_STATE', {
    mode: field('READ_ONLY'),
  }),
  canonicalState: contract('CANONICAL_STATE', {
    repository: field('alpha-phoenix-labs/alpha-agent-orchestrator'),
    branch: field('main'),
    head_sha: field('0123456789abcdef0123456789abcdef01234567'),
  }),
}

function currentConnection() {
  return markSnapshotResynced(
    markConnectionConnected(createConnectionResilienceState()),
  )
}

function DataProbe() {
  const data = useOperationsData()
  return (
    <div>
      <span data-testid="authority">{String(data.authorityAvailable)}</span>
      <span data-testid="snapshot">{data.snapshot === null ? 'NULL' : 'PRESENT'}</span>
      <span data-testid="connection">{data.connectionStatus}</span>
      <span data-testid="snapshot-status">{data.snapshotStatus}</span>
    </div>
  )
}

describe('Phase 4.12 connection resilience', () => {
  it('requires both a connected transport and a current snapshot before authority is available', () => {
    const connected = currentConnection()
    expect(connectionAuthorityAvailable(connected)).toBe(true)

    render(
      <OperationsDataProvider snapshot={snapshot} resilience={connected}>
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('authority')).toHaveTextContent('true')
    expect(screen.getByTestId('snapshot')).toHaveTextContent('PRESENT')
    expect(screen.getByTestId('connection')).toHaveTextContent('CONNECTED')
    expect(screen.getByTestId('snapshot-status')).toHaveTextContent('CURRENT')
  })

  it('marks retained data stale and hides it from UI authority immediately after connection loss', () => {
    const lost = markConnectionLost(currentConnection(), 'TRANSPORT_CLOSED')

    expect(lost.connectionStatus).toBe('RECONNECT_WAIT')
    expect(lost.snapshotStatus).toBe('STALE')
    expect(lost.nextRetryDelayMs).toBe(1_000)
    expect(connectionAuthorityAvailable(lost)).toBe(false)

    render(
      <OperationsDataProvider snapshot={snapshot} resilience={lost}>
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('authority')).toHaveTextContent('false')
    expect(screen.getByTestId('snapshot')).toHaveTextContent('NULL')
  })

  it('uses bounded exponential reconnect backoff', () => {
    let state = markConnectionLost(currentConnection())
    const delays = [state.nextRetryDelayMs]

    for (let index = 0; index < 6; index += 1) {
      state = markReconnectAttempt(state)
      state = markConnectionLost(state)
      delays.push(state.nextRetryDelayMs)
    }

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000])
  })

  it('does not restore authority merely because a reconnect succeeded', () => {
    let state = markConnectionLost(currentConnection())
    state = markReconnectAttempt(state)
    state = markConnectionConnected(state)

    expect(state.connectionStatus).toBe('CONNECTED')
    expect(state.snapshotStatus).toBe('STALE')
    expect(connectionAuthorityAvailable(state)).toBe(false)

    state = markSnapshotResynced(state)
    expect(state.snapshotStatus).toBe('CURRENT')
    expect(connectionAuthorityAvailable(state)).toBe(true)
  })

  it('turns a Phase 4.11 sequence gap into an explicit snapshot resync requirement', () => {
    const eventEvaluation = evaluateLiveEvent(createLiveEventCursor(10, 'state-v7'), {
      schema_version: 1,
      event_id: 'evt-gap',
      sequence: 12,
      base_state_version: 'state-v7',
      state_version: 'state-v8',
      emitted_at: '2026-09-17T00:30:00+00:00',
      event_type: 'WORK_ORDER_UPDATED',
      payload: { contract: 'WORK_ORDER' },
    })

    expect(eventEvaluation.decision).toBe('RESYNC_REQUIRED')

    const state = applyLiveEventEvaluation(currentConnection(), eventEvaluation)
    expect(state.connectionStatus).toBe('CONNECTED')
    expect(state.snapshotStatus).toBe('RESYNC_REQUIRED')
    expect(state.reason).toBe('MISSING_SEQUENCE')
    expect(connectionAuthorityAvailable(state)).toBe(false)
  })

  it('records heartbeat metadata without promoting unknown state into authority', () => {
    const state = recordHeartbeat(
      createConnectionResilienceState('REQUIRED'),
      '2026-09-17T00:31:00+00:00',
    )

    expect(state.lastHeartbeatAt).toBe('2026-09-17T00:31:00+00:00')
    expect(state.connectionStatus).toBe('UNKNOWN')
    expect(state.snapshotStatus).toBe('UNKNOWN')
    expect(connectionAuthorityAvailable(state)).toBe(false)
  })

  it('visibly fails closed instead of showing a retained snapshot as current after connection loss', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    const lost = markConnectionLost(currentConnection())

    render(
      <I18nProvider initialLocale="en-US">
        <OperationsDataProvider snapshot={snapshot} resilience={lost}>
          <RouterProvider router={router} />
        </OperationsDataProvider>
      </I18nProvider>,
    )

    const context = screen.getByRole('region', { name: 'Active context' })
    expect(context).toHaveTextContent('UNAVAILABLE · RECONNECT_WAIT · STALE')
    expect(context).toHaveTextContent('System modeUNKNOWN')
    expect(context).toHaveTextContent('RepositoryUNKNOWN')
    expect(context).toHaveTextContent('Canonical stateUNKNOWN')
    expect(context).not.toHaveTextContent('alpha-phoenix-labs/alpha-agent-orchestrator')
    expect(context).not.toHaveTextContent('0123456789ab')
  })
})
