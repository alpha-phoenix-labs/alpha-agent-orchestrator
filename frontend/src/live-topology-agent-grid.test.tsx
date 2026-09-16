import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { OperationsDataProvider } from './operations-data'
import { SystemSwarm } from './system-swarm'

afterEach(cleanup)

function known(source_class: SourceClass, value: unknown): ViewField {
  return { source_class, available: true, value, reason: null }
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

const leader = view('AGENT', {
  agent_id: known('AUTHORITATIVE', 'leader-1'),
  role: known('AUTHORITATIVE', 'LEADER'),
  health: known('RUNTIME', 'HEALTHY'),
  runtime_state: known('RUNTIME', 'RUNNING'),
  activity: known('RUNTIME', 'ROUTING'),
})

const agent = view('AGENT', {
  agent_id: known('AUTHORITATIVE', 'reader-1'),
  role: known('AUTHORITATIVE', 'READER'),
  health: known('RUNTIME', 'HEALTHY'),
  runtime_state: known('RUNTIME', 'RUNNING'),
  activity: known('RUNTIME', 'THINKING'),
})

const telemetry = view('TELEMETRY', {
  metrics: known('TELEMETRY', { latency_ms: 17, tokens_per_second: 33 }),
  observed_at: known('TELEMETRY', '2026-09-16T21:20:00+00:00'),
})

describe('Phase 4.9 Live topology and Agent Grid', () => {
  it('keeps the topology and Agent Grid surfaces visible while authority is unavailable', () => {
    renderSystemSwarm()

    expect(screen.getByRole('region', { name: 'Live Topology' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Agent Grid' })).toBeInTheDocument()
    expect(screen.getByText('Phase 4.9 · read-only topology')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uses only the backend-selected Leader contract and does not invent worker membership or activity edges', () => {
    renderSystemSwarm({ leader, agents: [agent] })

    const topology = screen.getByRole('region', { name: 'Live Topology' })
    expect(topology).toHaveTextContent('leader-1')
    expect(topology).toHaveTextContent('ROUTING')
    expect(topology).toHaveTextContent('reader-1')
    expect(topology).toHaveTextContent('THINKING')
    expect(topology).toHaveTextContent('NO_EXPLICIT_WORKER_MEMBERSHIP_CONTRACT')
    expect(topology).toHaveTextContent('NO_RUNTIME_ACTIVITY_EDGE_CONTRACT')
    expect(topology).toHaveTextContent('animated edge ≠ verified')
    expect(topology).toHaveTextContent('glow ≠ approved')
    expect(topology).toHaveTextContent('active agent ≠ write permitted')
  })

  it('keeps Work Order association and per-Agent metrics explicitly unavailable', () => {
    renderSystemSwarm({ agents: [agent], telemetry })

    const grid = screen.getByRole('region', { name: 'Agent Grid' })
    expect(grid).toHaveTextContent('reader-1')
    expect(grid).toHaveTextContent('HEALTHY')
    expect(grid).toHaveTextContent('RUNNING')
    expect(grid).toHaveTextContent('THINKING')
    expect(grid).toHaveTextContent('NO_AGENT_WORK_ORDER_ASSOCIATION_CONTRACT')
    expect(grid).toHaveTextContent('NO_PER_AGENT_LATENCY_CONTRACT')
    expect(grid).toHaveTextContent('NO_PER_AGENT_TOKENS_RATE_CONTRACT')
    expect(grid).toHaveTextContent('NO_PER_AGENT_CONTEXT_USAGE_CONTRACT')
    expect(within(grid).queryByText(/latency_ms/)).not.toBeInTheDocument()
    expect(within(grid).queryByText(/tokens_per_second/)).not.toBeInTheDocument()
  })

  it('does not synthesize topology or grid nodes from an explicitly empty Agent collection', () => {
    renderSystemSwarm({ agents: [] })

    const topology = screen.getByRole('region', { name: 'Live Topology' })
    const grid = screen.getByRole('region', { name: 'Agent Grid' })

    expect(topology).toHaveTextContent('NO_BACKEND_SELECTED_LEADER_NODE')
    expect(within(topology).getByText('0 backend-reported records.')).toBeInTheDocument()
    expect(within(grid).getByText('0 backend-reported records.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
