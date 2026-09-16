import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { OperationsDataProvider } from './operations-data'
import { TraceWaterfall } from './trace-waterfall'

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

function renderTrace(snapshot?: OperationsSnapshot | null) {
  render(
    <OperationsDataProvider snapshot={snapshot}>
      <TraceWaterfall />
    </OperationsDataProvider>,
  )
}

const evidence = view('EVIDENCE', {
  source: known('EVIDENCE', 'github'),
  reference: known('EVIDENCE', 'https://example.invalid/read/7'),
  observed_at: known('EVIDENCE', '2026-09-16T21:00:00+00:00'),
  digest: known('EVIDENCE', 'e'.repeat(64)),
  verification_state: known('EVIDENCE', 'READ_VALIDATED'),
})

const provenance = view('PROVENANCE', {
  observation_id: known('EVIDENCE', 'OBS-7'),
  source: known('EVIDENCE', 'github'),
  target_id: known('EVIDENCE', 'repo:alpha-agent-orchestrator'),
  observed_url: known('EVIDENCE', 'https://example.invalid/read/7'),
  status: known('EVIDENCE', 200),
  observed_at: known('EVIDENCE', '2026-09-16T21:00:00+00:00'),
  body_digest: known('EVIDENCE', 'b'.repeat(64)),
  body_size: known('EVIDENCE', 7),
  freshness_result: known('EVIDENCE', 'FRESH'),
  freshness_max_age_seconds: known('EVIDENCE', 60),
  collector_id: known('EVIDENCE', 'github_branch_reader'),
  transport_id: known('EVIDENCE', 'github-http-read'),
  verification_state: known('EVIDENCE', 'READ_VALIDATED'),
})

const finding = view('FINDING', {
  reader_id: known('EVIDENCE', 'github_branch_reader'),
  claim: known('EVIDENCE', 'repository state observed'),
  observation_id: known('EVIDENCE', 'OBS-7'),
  evidence: known('EVIDENCE', evidence),
  provenance: known('EVIDENCE', provenance),
  classification: unknown('EVIDENCE', 'NO_AUTHORITATIVE_FINDING_CLASSIFICATION'),
})

const plan = view('PLAN', {
  order_id: known('WORK_ORDER', 'WO-7'),
  action: known('WORK_ORDER', 'git_commit'),
  target: known('WORK_ORDER', 'docs/example.md'),
  expected_effect: known('WORK_ORDER', 'document trace state'),
  risk: known('WORK_ORDER', 'LOW'),
  base_state_version: known('WORK_ORDER', 'state-v7'),
  plan_hash: known('WORK_ORDER', 'plan-7'),
  proposed_writer: known('WORK_ORDER', 'code_writer'),
  created_at: known('WORK_ORDER', '2026-09-16T21:01:00+00:00'),
  simulation_only: known('WORK_ORDER', true),
})

describe('Phase 4.10 Trace / Waterfall', () => {
  it('fails closed while keeping the roadmap stages visible without authority', () => {
    renderTrace()

    const trace = screen.getByRole('region', { name: 'Trace / Waterfall' })
    for (const stage of ['Route', 'Read', 'Verify', 'Plan', 'Human Gate', 'Execution', 'Post Verify']) {
      expect(within(trace).getByText(stage)).toBeInTheDocument()
    }

    expect(trace).toHaveTextContent('NO_ROUTE_STAGE_CONTRACT')
    expect(trace).toHaveTextContent('NO_FINDING_PROVENANCE_FOR_READ_TRACE')
    expect(trace).toHaveTextContent('NO_FINDING_EVIDENCE_FOR_VERIFY_TRACE')
    expect(trace).toHaveTextContent('NO_PLAN_TRACE_CONTRACT_AVAILABLE')
    expect(trace).toHaveTextContent('NO_PHASE4_APPROVAL_TRACE_CONTRACT')
    expect(trace).toHaveTextContent('PHASE4_EXECUTION_NOT_AVAILABLE')
    expect(trace).toHaveTextContent('PHASE4_POST_VERIFY_NOT_AVAILABLE')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows only backend-supplied temporal anchors and preserves missing relationships', () => {
    renderTrace({ findings: [finding], plan })

    const trace = screen.getByRole('region', { name: 'Trace / Waterfall' })
    expect(trace).toHaveTextContent('OBS-7')
    expect(trace).toHaveTextContent('2026-09-16T21:00:00+00:00')
    expect(trace).toHaveTextContent('READ_VALIDATED')
    expect(trace).toHaveTextContent('NO_VERIFICATION_TIMESTAMP_CONTRACT')
    expect(trace).toHaveTextContent('WO-7')
    expect(trace).toHaveTextContent('2026-09-16T21:01:00+00:00')
    expect(trace).toHaveTextContent('NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP')
    expect(trace).toHaveTextContent('Trace/Activity remains observability')
  })

  it('does not promote Audit events into trace authority', () => {
    renderTrace({
      audit: [
        view('AUDIT', {
          seq: known('AUTHORITATIVE', 9),
          event_type: known('AUTHORITATIVE', 'SHADOW_PLAN_CREATED'),
          created_at: known('AUTHORITATIVE', '2026-09-16T21:02:00+00:00'),
          prev_hash: known('AUTHORITATIVE', 'prev-9'),
          event_hash: known('AUTHORITATIVE', 'event-9'),
          payload: unknown('AUTHORITATIVE', 'RAW_AUDIT_PAYLOAD_NOT_UI_SAFE'),
        }),
      ],
    })

    const trace = screen.getByRole('region', { name: 'Trace / Waterfall' })
    expect(trace).not.toHaveTextContent('SHADOW_PLAN_CREATED')
    expect(trace).toHaveTextContent('Audit events are not copied into this waterfall')
  })

  it('does not synthesize read or verification records from empty backend findings', () => {
    renderTrace({ findings: [] })

    const trace = screen.getByRole('region', { name: 'Trace / Waterfall' })
    expect(trace).toHaveTextContent('0 backend-reported read observations.')
    expect(trace).toHaveTextContent('0 backend-reported verification observations.')
    expect(trace).not.toHaveTextContent('OBS-7')
  })
})
