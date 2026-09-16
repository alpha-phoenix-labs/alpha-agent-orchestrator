import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { OperationsDataProvider } from './operations-data'
import { SystemSwarm } from './system-swarm'

afterEach(cleanup)

function known(source_class: SourceClass, value: unknown): ViewField {
  return { source_class, available: true, value, reason: null }
}

function unknown(source_class: SourceClass, reason: string): ViewField {
  return { source_class, available: false, value: null, reason }
}

function view(contract: string, fields: Record<string, ViewField>): ViewContract {
  return { contract, fields }
}

function renderSystemSwarm(snapshot?: OperationsSnapshot | null) {
  render(
    <OperationsDataProvider snapshot={snapshot}>
      <SystemSwarm />
    </OperationsDataProvider>,
  )
}

const systemState = view('SYSTEM_STATE', {
  mode: known('AUTHORITATIVE', 'SHADOW'),
  writes_enabled: known('AUTHORITATIVE', false),
  state_version: known('AUTHORITATIVE', 42),
})

const canonicalState = view('CANONICAL_STATE', {
  repository: known('AUTHORITATIVE', 'alpha-phoenix-labs/alpha-agent-orchestrator'),
  branch: known('AUTHORITATIVE', 'main'),
  head_sha: known('AUTHORITATIVE', '4'.repeat(40)),
  observed_at: known('AUTHORITATIVE', '2026-09-16T21:00:00+00:00'),
  freshness_result: known('AUTHORITATIVE', 'FRESH'),
})

const agent = view('AGENT', {
  agent_id: known('AUTHORITATIVE', 'reader-1'),
  role: known('AUTHORITATIVE', 'READER'),
  health: known('RUNTIME', 'HEALTHY'),
  runtime_state: known('RUNTIME', 'RUNNING'),
  activity: known('RUNTIME', 'THINKING'),
})

const connector = view('CONNECTOR', {
  connector_id: known('AUTHORITATIVE', 'github-read'),
  state: known('RUNTIME', 'READY'),
  health: known('RUNTIME', 'HEALTHY'),
  auth_state: known('RUNTIME', 'BACKEND_OWNED'),
})

const lock = view('LOCK', {
  resource: known('AUTHORITATIVE', 'repo:alpha-agent-orchestrator'),
  owner: known('AUTHORITATIVE', 'WO-42'),
  order_id: known('AUTHORITATIVE', 'WO-42'),
  acquired_at: known('AUTHORITATIVE', '2026-09-16T21:01:00+00:00'),
})

const gate = view('GATE', {
  gate_id: known('AUTHORITATIVE', 'PRE_EXECUTE'),
  allowed: known('AUTHORITATIVE', false),
  reason: known('AUTHORITATIVE', 'WRITES_DISABLED'),
})

const runtime = view('RUNTIME', {
  state: known('RUNTIME', 'ONLINE'),
  observed_at: known('RUNTIME', '2026-09-16T21:02:00+00:00'),
})

const telemetry = view('TELEMETRY', {
  metrics: known('TELEMETRY', { requests: 7 }),
  observed_at: known('TELEMETRY', '2026-09-16T21:02:30+00:00'),
})

const snapshot: OperationsSnapshot = {
  systemState,
  canonicalState,
  agents: [agent],
  connectors: [connector],
  locks: [lock],
  gates: [gate],
  runtime,
  telemetry,
}

describe('Phase 4.8 System / Swarm', () => {
  it('fails closed while keeping every required surface visible without authority', () => {
    renderSystemSwarm()

    expect(screen.getByRole('heading', { name: 'System / Swarm' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('snapshot unavailable')

    for (const regionName of [
      'System Overview',
      'Agents',
      'Connectors',
      'Locks',
      'Policies',
      'Control Plane',
      'System Health',
    ]) {
      expect(screen.getByRole('region', { name: regionName })).toBeInTheDocument()
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('keeps agent health, runtime state, activity and telemetry semantically separate', () => {
    renderSystemSwarm(snapshot)

    const agents = screen.getByRole('region', { name: 'Agents' })
    expect(agents).toHaveTextContent('reader-1')
    expect(agents).toHaveTextContent('HEALTHY')
    expect(agents).toHaveTextContent('RUNNING')
    expect(agents).toHaveTextContent('THINKING')
    expect(agents).toHaveTextContent('NO_PER_AGENT_TELEMETRY_CONTRACT')
    expect(agents).toHaveTextContent('THINKING are never interpreted as Health or permission state')

    const health = screen.getByRole('region', { name: 'System Health' })
    expect(health).toHaveTextContent('ONLINE')
    expect(health).toHaveTextContent('{"requests":7}')
    expect(health).toHaveTextContent('NO_AGGREGATE_SYSTEM_HEALTH_CONTRACT')
  })

  it('renders backed control-plane facts without inventing policy or control authority', () => {
    renderSystemSwarm(snapshot)

    const overview = screen.getByRole('region', { name: 'System Overview' })
    expect(overview).toHaveTextContent('SHADOW')
    expect(overview).toHaveTextContent('false')
    expect(overview).toHaveTextContent('alpha-phoenix-labs/alpha-agent-orchestrator')

    const connectors = screen.getByRole('region', { name: 'Connectors' })
    expect(connectors).toHaveTextContent('github-read')
    expect(connectors).toHaveTextContent('BACKEND_OWNED')

    const locks = screen.getByRole('region', { name: 'Locks' })
    expect(locks).toHaveTextContent('repo:alpha-agent-orchestrator')
    expect(locks).toHaveTextContent('WO-42')

    const policies = screen.getByRole('region', { name: 'Policies' })
    expect(policies).toHaveTextContent('NO_POLICY_VIEW_CONTRACT')

    const controlPlane = screen.getByRole('region', { name: 'Control Plane' })
    expect(controlPlane).toHaveTextContent('PRE_EXECUTE')
    expect(controlPlane).toHaveTextContent('WRITES_DISABLED')
    expect(controlPlane).toHaveTextContent('no agent command')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('preserves explicit unavailable reasons and does not synthesize empty collections', () => {
    renderSystemSwarm({
      agents: [
        view('AGENT', {
          agent_id: unknown('AUTHORITATIVE', 'NO_AGENT_RUNTIME_AUTHORITY'),
          role: unknown('AUTHORITATIVE', 'NO_AGENT_RUNTIME_AUTHORITY'),
          health: unknown('RUNTIME', 'NO_AGENT_RUNTIME_AUTHORITY'),
          runtime_state: unknown('RUNTIME', 'NO_AGENT_RUNTIME_AUTHORITY'),
          activity: unknown('RUNTIME', 'NO_AGENT_RUNTIME_AUTHORITY'),
        }),
      ],
      connectors: [],
      locks: [],
      gates: [],
      runtime: view('RUNTIME', {
        state: unknown('RUNTIME', 'NO_RUNTIME_AUTHORITY'),
        observed_at: unknown('RUNTIME', 'NO_RUNTIME_AUTHORITY'),
      }),
      telemetry: view('TELEMETRY', {
        metrics: unknown('TELEMETRY', 'NO_TELEMETRY_AUTHORITY'),
        observed_at: unknown('TELEMETRY', 'NO_TELEMETRY_AUTHORITY'),
      }),
    })

    const agents = screen.getByRole('region', { name: 'Agents' })
    expect(within(agents).getAllByText('UNKNOWN')).toHaveLength(5)
    expect(agents).toHaveTextContent('NO_AGENT_RUNTIME_AUTHORITY')

    const health = screen.getByRole('region', { name: 'System Health' })
    expect(health).toHaveTextContent('NO_RUNTIME_AUTHORITY')
    expect(health).toHaveTextContent('NO_TELEMETRY_AUTHORITY')

    expect(screen.getAllByText('0 backend-reported records.')).toHaveLength(3)
  })
})
