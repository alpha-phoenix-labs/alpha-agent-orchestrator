import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { routes } from './App'
import type { OperationsSnapshot, ViewContract, ViewField } from './contracts'
import { I18nProvider } from './i18n'
import { OperationsDataProvider, useOperationsData } from './operations-data'
import { evaluateViewStateContext } from './state-drift'

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

function snapshot(stateVersion: string | null): OperationsSnapshot {
  return {
    systemState: contract('SYSTEM_STATE', {
      mode: field('READ_ONLY'),
      writes_enabled: field(false),
      state_version:
        stateVersion === null
          ? {
              source_class: 'AUTHORITATIVE',
              available: false,
              value: null,
              reason: 'STATE_VERSION_UNAVAILABLE',
            }
          : field(stateVersion),
    }),
    canonicalState: contract('CANONICAL_STATE', {
      repository: field('alpha-phoenix-labs/alpha-agent-orchestrator'),
      branch: field('main'),
      head_sha: field('0123456789abcdef0123456789abcdef01234567'),
    }),
  }
}

function DataProbe() {
  const data = useOperationsData()
  return (
    <div>
      <span data-testid="snapshot">{data.snapshot === null ? 'NULL' : 'PRESENT'}</span>
      <span data-testid="current-snapshot">{data.currentSnapshot === null ? 'NULL' : 'PRESENT'}</span>
      <span data-testid="authority">{String(data.authorityAvailable)}</span>
      <span data-testid="current-authority">{String(data.currentAuthorityAvailable)}</span>
      <span data-testid="view-status">{data.viewContextStatus}</span>
      <span data-testid="view-reason">{data.viewContextReason}</span>
      <span data-testid="approval-invalidation">{String(data.approvalInvalidationAvailable)}</span>
      <span data-testid="approval-reason">{data.approvalInvalidationReason}</span>
    </div>
  )
}

describe('Phase 4.13 state drift and historical-state separation', () => {
  it('keeps a live view current when its viewed and current state versions match', () => {
    const state = evaluateViewStateContext({
      currentSnapshot: snapshot('state-7'),
      viewedStateVersion: 'state-7',
    })

    expect(state.managed).toBe(true)
    expect(state.status).toBe('CURRENT')
    expect(state.staleContext).toBe(false)
    expect(state.currentSnapshotPermitted).toBe(true)
    expect(state.reason).toBe('STATE_VERSION_MATCH')
  })

  it('fails closed when a managed live view drifts from the current state version', () => {
    render(
      <OperationsDataProvider snapshot={snapshot('state-8')} viewedStateVersion="state-7">
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('snapshot')).toHaveTextContent('NULL')
    expect(screen.getByTestId('current-snapshot')).toHaveTextContent('PRESENT')
    expect(screen.getByTestId('authority')).toHaveTextContent('false')
    expect(screen.getByTestId('current-authority')).toHaveTextContent('true')
    expect(screen.getByTestId('view-status')).toHaveTextContent('STALE')
    expect(screen.getByTestId('view-reason')).toHaveTextContent('STATE_VERSION_DRIFT')
  })

  it('fails closed when a managed viewed state exists but current state version is unavailable', () => {
    render(
      <OperationsDataProvider snapshot={snapshot(null)} viewedStateVersion="state-7">
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('snapshot')).toHaveTextContent('NULL')
    expect(screen.getByTestId('view-status')).toHaveTextContent('UNKNOWN')
    expect(screen.getByTestId('view-reason')).toHaveTextContent('CURRENT_STATE_VERSION_UNAVAILABLE')
  })

  it('never substitutes the current live snapshot into historical mode', () => {
    render(
      <OperationsDataProvider
        snapshot={snapshot('state-8')}
        viewMode="HISTORICAL"
        viewedStateVersion="state-3"
      >
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('snapshot')).toHaveTextContent('NULL')
    expect(screen.getByTestId('current-snapshot')).toHaveTextContent('PRESENT')
    expect(screen.getByTestId('authority')).toHaveTextContent('false')
    expect(screen.getByTestId('view-status')).toHaveTextContent('HISTORICAL')
    expect(screen.getByTestId('view-reason')).toHaveTextContent(
      'HISTORICAL_VIEW_CURRENT_SNAPSHOT_SEPARATED',
    )
  })

  it('preserves existing live snapshot behavior when no viewed-state binding is supplied', () => {
    render(
      <OperationsDataProvider snapshot={snapshot('state-8')}>
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('snapshot')).toHaveTextContent('PRESENT')
    expect(screen.getByTestId('authority')).toHaveTextContent('true')
    expect(screen.getByTestId('view-status')).toHaveTextContent('UNKNOWN')
    expect(screen.getByTestId('view-reason')).toHaveTextContent('NO_VIEWED_STATE_BINDING')
  })

  it('does not infer approval invalidation from state drift', () => {
    render(
      <OperationsDataProvider snapshot={snapshot('state-8')} viewedStateVersion="state-7">
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('approval-invalidation')).toHaveTextContent('false')
    expect(screen.getByTestId('approval-reason')).toHaveTextContent('NO_APPROVAL_VIEW_CONTRACT')
  })

  it('renders viewed and current state separately and exposes stale context visibly', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })

    render(
      <I18nProvider initialLocale="en-US">
        <OperationsDataProvider snapshot={snapshot('state-8')} viewedStateVersion="state-7">
          <RouterProvider router={router} />
        </OperationsDataProvider>
      </I18nProvider>,
    )

    const stateContext = screen.getByLabelText('STATE CONTEXT')
    expect(stateContext).toHaveTextContent('state-7')
    expect(stateContext).toHaveTextContent('state-8')
    expect(stateContext).toHaveTextContent('STALE · STATE_VERSION_DRIFT')
    expect(stateContext).toHaveTextContent('UNAVAILABLE · NO_APPROVAL_VIEW_CONTRACT')
    expect(screen.getByText(/main · 0123456789ab/)).toBeInTheDocument()
  })
})
