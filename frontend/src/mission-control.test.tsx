import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { MissionControl } from './mission-control'
import { OperationsDataProvider } from './operations-data'

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

function renderMissionControl(snapshot?: OperationsSnapshot | null) {
  render(
    <OperationsDataProvider snapshot={snapshot}>
      <MissionControl />
    </OperationsDataProvider>,
  )
}

const snapshot: OperationsSnapshot = {
  systemState: view('SYSTEM_STATE', {
    mode: known('AUTHORITATIVE', 'READ_ONLY'),
    writes_enabled: known('AUTHORITATIVE', false),
  }),
  canonicalState: view('CANONICAL_STATE', {
    repository: known('AUTHORITATIVE', 'alpha-phoenix-labs/alpha-agent-orchestrator'),
    branch: known('AUTHORITATIVE', 'main'),
    head_sha: known('AUTHORITATIVE', 'abc123def456'),
    observed_at: known('AUTHORITATIVE', '2026-09-16T19:00:00+00:00'),
    freshness_result: known('AUTHORITATIVE', 'FRESH'),
  }),
  activeWorkOrder: view('WORK_ORDER', {
    order_id: known('WORK_ORDER', 'WO-7'),
    status: known('WORK_ORDER', 'WAITING_FOR_APPROVAL'),
    risk: known('WORK_ORDER', 'LOW'),
    action: known('WORK_ORDER', 'git_commit'),
    target: known('WORK_ORDER', 'docs/example.md'),
    base_state_version: known('WORK_ORDER', 'state-v1'),
  }),
  lifecycle: view('LIFECYCLE', {
    order_status: known('WORK_ORDER', 'WAITING_FOR_APPROVAL'),
    stage: unknown('WORK_ORDER', 'NO_AUTHORITATIVE_LIFECYCLE_STAGE'),
  }),
  findings: [
    view('FINDING', {
      claim: known('EVIDENCE', 'default branch is main'),
      reader_id: known('EVIDENCE', 'github_reader'),
      observation_id: known('EVIDENCE', 'obs-7'),
      classification: unknown('EVIDENCE', 'NO_AUTHORITATIVE_FINDING_CLASSIFICATION'),
    }),
  ],
  evidence: [
    view('EVIDENCE', {
      source: known('EVIDENCE', 'github'),
      reference: known('EVIDENCE', 'obs-7'),
      verification_state: known('EVIDENCE', 'READ_VALIDATED'),
    }),
  ],
  audit: [
    view('AUDIT_EVENT', {
      seq: known('AUTHORITATIVE', 17),
      event_type: known('AUTHORITATIVE', 'WORK_ORDER_OBSERVED'),
      created_at: known('AUTHORITATIVE', '2026-09-16T19:00:04+00:00'),
    }),
  ],
  gates: [
    view('GATE', {
      gate_id: known('AUTHORITATIVE', 'PRE_APPROVAL'),
      allowed: known('AUTHORITATIVE', false),
      reason: known('AUTHORITATIVE', 'STALE_STATE'),
    }),
  ],
  locks: [
    view('LOCK', {
      resource: known('AUTHORITATIVE', 'repo:docs/example.md'),
      owner: known('AUTHORITATIVE', 'leader'),
      order_id: known('AUTHORITATIVE', 'WO-7'),
    }),
  ],
  writer: view('WRITER', {
    writer_id: known('WORK_ORDER', 'code_writer'),
    proposal_only: known('WORK_ORDER', true),
    runtime_state: unknown('RUNTIME', 'NO_AUTHORITATIVE_WRITER_RUNTIME_STATE'),
  }),
  leader: view('AGENT', {
    agent_id: known('AUTHORITATIVE', 'leader'),
    role: known('AUTHORITATIVE', 'LEADER'),
    runtime_state: unknown('RUNTIME', 'NO_AUTHORITATIVE_AGENT_RUNTIME_STATE'),
    activity: unknown('RUNTIME', 'NO_AUTHORITATIVE_AGENT_ACTIVITY'),
  }),
  agents: [
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'reader-01'),
      role: known('AUTHORITATIVE', 'READER'),
      health: unknown('AUTHORITATIVE', 'NO_AUTHORITATIVE_AGENT_HEALTH'),
      runtime_state: unknown('RUNTIME', 'NO_AUTHORITATIVE_AGENT_RUNTIME_STATE'),
      activity: unknown('RUNTIME', 'NO_AUTHORITATIVE_AGENT_ACTIVITY'),
    }),
  ],
}

describe('Phase 4.5 Mission Control', () => {
  it('fails closed and exposes no operational controls without a backend snapshot', () => {
    renderMissionControl()

    expect(screen.getByRole('heading', { name: 'Mission Control' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Authoritative Mission Control snapshot unavailable')

    for (const panelName of [
      'Leader interaction',
      'Lifecycle',
      'Current Findings',
      'System mode',
      'Canonical State',
      'Active Work Order',
      'Gates',
      'Locks',
      'Writer status',
      'Blockers',
      'Live Topology',
      'Agent Grid',
      'Evidence Summary',
      'Audit Timeline',
    ]) {
      expect(screen.getByRole('region', { name: panelName })).toBeInTheDocument()
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders the premium three-zone read-only composition from backend contracts', () => {
    renderMissionControl(snapshot)

    const topology = screen.getByRole('region', { name: 'Live Topology' })
    expect(topology).toHaveTextContent('leader')
    expect(topology).toHaveTextContent('reader-01')
    expect(topology).toHaveTextContent('NO_RUNTIME_ACTIVITY_EDGE_CONTRACT')

    const agentGrid = screen.getByRole('region', { name: 'Agent Grid' })
    expect(agentGrid).toHaveTextContent('reader-01')
    expect(agentGrid).toHaveTextContent('NO_AUTHORITATIVE_AGENT_HEALTH')

    const audit = screen.getByRole('region', { name: 'Audit Timeline' })
    expect(audit).toHaveTextContent('17')
    expect(audit).toHaveTextContent('WORK_ORDER_OBSERVED')

    expect(screen.getByLabelText('Mission Control rail')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders backend-reported Mission Control contracts without deriving missing authority', () => {
    renderMissionControl(snapshot)

    const order = screen.getByRole('region', { name: 'Active Work Order' })
    expect(order).toHaveTextContent('WO-7')
    expect(order).toHaveTextContent('WAITING_FOR_APPROVAL')
    expect(order).toHaveTextContent('git_commit')

    const lifecycle = screen.getByRole('region', { name: 'Lifecycle' })
    expect(lifecycle).toHaveTextContent('UNKNOWN')
    expect(lifecycle).toHaveTextContent('NO_AUTHORITATIVE_LIFECYCLE_STAGE')

    const evidence = screen.getByRole('region', { name: 'Evidence Summary' })
    expect(evidence).toHaveTextContent('Backend-reported references: 1')
    expect(evidence).toHaveTextContent('READ_VALIDATED')

    const gates = screen.getByRole('region', { name: 'Gates' })
    expect(gates).toHaveTextContent('PRE_APPROVAL')
    expect(gates).toHaveTextContent('false')
    expect(gates).toHaveTextContent('STALE_STATE')

    const canonical = screen.getByRole('region', { name: 'Canonical State' })
    expect(canonical).toHaveTextContent('alpha-phoenix-labs/alpha-agent-orchestrator')
    expect(canonical).toHaveTextContent('abc123def456')

    const writer = screen.getByRole('region', { name: 'Writer status' })
    expect(writer).toHaveTextContent('code_writer')
    expect(writer).toHaveTextContent('true')
    expect(writer).toHaveTextContent('NO_AUTHORITATIVE_WRITER_RUNTIME_STATE')

    const blockers = screen.getByRole('region', { name: 'Blockers' })
    expect(within(blockers).getByText('UNAVAILABLE')).toBeInTheDocument()
    expect(blockers).toHaveTextContent('does not reclassify gate denials')
  })
})
