import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { OperationsDataProvider } from './operations-data'
import { WorkOrders } from './work-orders'

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

function renderWorkOrders(snapshot?: OperationsSnapshot | null) {
  render(
    <OperationsDataProvider snapshot={snapshot}>
      <WorkOrders />
    </OperationsDataProvider>,
  )
}

const snapshot: OperationsSnapshot = {
  workOrders: [
    view('WORK_ORDER', {
      order_id: known('WORK_ORDER', 'WO-42'),
      action: known('WORK_ORDER', 'git_commit'),
      target: known('WORK_ORDER', 'docs/example.md'),
      base_state_version: known('WORK_ORDER', 'state-v42'),
      expected_effect: known('WORK_ORDER', 'document the read-only workflow'),
      risk: known('WORK_ORDER', 'LOW'),
      status: known('WORK_ORDER', 'WAITING_FOR_APPROVAL'),
      evidence_verified: known('WORK_ORDER', true),
      independent_review_confirmed: known('WORK_ORDER', true),
      plan_hash: known('WORK_ORDER', 'plan-42'),
      created_at: known('WORK_ORDER', '2026-09-16T19:00:00+00:00'),
    }),
  ],
  lifecycle: view('LIFECYCLE', {
    order_status: known('WORK_ORDER', 'WAITING_FOR_APPROVAL'),
    stage: unknown('WORK_ORDER', 'NO_AUTHORITATIVE_LIFECYCLE_STAGE'),
  }),
  evidence: [
    view('EVIDENCE', {
      source: known('EVIDENCE', 'github'),
      reference: known('EVIDENCE', 'obs-42'),
      observed_at: known('EVIDENCE', '2026-09-16T19:01:00+00:00'),
      digest: known('EVIDENCE', 'sha256:evidence42'),
      verification_state: known('EVIDENCE', 'READ_VALIDATED'),
    }),
  ],
  findings: [
    view('FINDING', {
      reader_id: known('EVIDENCE', 'github_reader'),
      claim: known('EVIDENCE', 'default branch is main'),
      observation_id: known('EVIDENCE', 'obs-42'),
      classification: unknown('EVIDENCE', 'NO_AUTHORITATIVE_FINDING_CLASSIFICATION'),
    }),
  ],
  plan: view('PLAN', {
    order_id: known('WORK_ORDER', 'WO-42'),
    action: known('WORK_ORDER', 'git_commit'),
    target: known('WORK_ORDER', 'docs/example.md'),
    expected_effect: known('WORK_ORDER', 'document the read-only workflow'),
    risk: known('WORK_ORDER', 'LOW'),
    base_state_version: known('WORK_ORDER', 'state-v42'),
    plan_hash: known('WORK_ORDER', 'plan-42'),
    proposed_writer: known('WORK_ORDER', 'code_writer'),
    created_at: known('WORK_ORDER', '2026-09-16T19:02:00+00:00'),
    simulation_only: known('WORK_ORDER', true),
  }),
  audit: [
    view('AUDIT', {
      seq: known('AUTHORITATIVE', 7),
      event_type: known('AUTHORITATIVE', 'WORK_ORDER_PLANNED'),
      created_at: known('AUTHORITATIVE', '2026-09-16T19:03:00+00:00'),
      prev_hash: known('AUTHORITATIVE', 'prev-7'),
      event_hash: known('AUTHORITATIVE', 'event-7'),
      payload: unknown('AUTHORITATIVE', 'RAW_AUDIT_PAYLOAD_NOT_UI_SAFE'),
    }),
  ],
}

describe('Phase 4.6 Work Orders', () => {
  it('fails closed and exposes all required read-only regions without backend authority', () => {
    renderWorkOrders()

    expect(screen.getByRole('heading', { name: 'Work Orders' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Authoritative Work Order snapshot unavailable')

    for (const regionName of ['Overview', 'Lifecycle', 'Evidence', 'Findings', 'Plan', 'Audit']) {
      expect(screen.getByRole('region', { name: regionName })).toBeInTheDocument()
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders backend-reported Work Order contracts without inventing missing authority', () => {
    renderWorkOrders(snapshot)

    const overview = screen.getByRole('region', { name: 'Overview' })
    expect(overview).toHaveTextContent('WO-42')
    expect(overview).toHaveTextContent('WAITING_FOR_APPROVAL')
    expect(overview).toHaveTextContent('git_commit')
    expect(overview).toHaveTextContent('plan-42')

    const lifecycle = screen.getByRole('region', { name: 'Lifecycle' })
    expect(lifecycle).toHaveTextContent('UNKNOWN')
    expect(lifecycle).toHaveTextContent('NO_AUTHORITATIVE_LIFECYCLE_STAGE')
    expect(lifecycle).toHaveTextContent('remain non-operative')

    const evidence = screen.getByRole('region', { name: 'Evidence' })
    expect(evidence).toHaveTextContent('READ_VALIDATED')
    expect(evidence).toHaveTextContent('sha256:evidence42')

    const findings = screen.getByRole('region', { name: 'Findings' })
    expect(findings).toHaveTextContent('default branch is main')
    expect(findings).toHaveTextContent('NO_AUTHORITATIVE_FINDING_CLASSIFICATION')

    const plan = screen.getByRole('region', { name: 'Plan' })
    expect(plan).toHaveTextContent('code_writer')
    expect(plan).toHaveTextContent('true')

    const audit = screen.getByRole('region', { name: 'Audit' })
    expect(audit).toHaveTextContent('WORK_ORDER_PLANNED')
    expect(within(audit).getByText('UNKNOWN')).toBeInTheDocument()
    expect(audit).toHaveTextContent('RAW_AUDIT_PAYLOAD_NOT_UI_SAFE')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not infer records when backend collections are explicitly empty', () => {
    renderWorkOrders({ workOrders: [], evidence: [], findings: [], audit: [] })

    expect(screen.getAllByText('0 backend-reported records.')).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Lifecycle' })).toHaveTextContent('UNAVAILABLE')
    expect(screen.getByRole('region', { name: 'Plan' })).toHaveTextContent('UNAVAILABLE')
  })
})
