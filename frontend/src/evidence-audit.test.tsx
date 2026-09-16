import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import { EvidenceAudit } from './evidence-audit'
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

function renderEvidenceAudit(snapshot?: OperationsSnapshot | null) {
  render(
    <OperationsDataProvider snapshot={snapshot}>
      <EvidenceAudit />
    </OperationsDataProvider>,
  )
}

const evidence = view('EVIDENCE', {
  source: known('EVIDENCE', 'github'),
  reference: known('EVIDENCE', 'https://example.invalid/read/42'),
  observed_at: known('EVIDENCE', '2026-09-16T19:01:00+00:00'),
  digest: known('EVIDENCE', 'e'.repeat(64)),
  verification_state: known('EVIDENCE', 'READ_VALIDATED'),
})

const provenance = view('PROVENANCE', {
  observation_id: known('EVIDENCE', 'OBS-42'),
  source: known('EVIDENCE', 'github'),
  target_id: known('EVIDENCE', 'repo:alpha-agent-orchestrator'),
  observed_url: known('EVIDENCE', 'https://example.invalid/read/42'),
  status: known('EVIDENCE', 200),
  observed_at: known('EVIDENCE', '2026-09-16T19:01:00+00:00'),
  body_digest: known('EVIDENCE', 'b'.repeat(64)),
  body_size: known('EVIDENCE', 42),
  freshness_result: known('EVIDENCE', 'FRESH'),
  freshness_max_age_seconds: known('EVIDENCE', 60),
  collector_id: known('EVIDENCE', 'github_branch_reader'),
  transport_id: known('EVIDENCE', 'render-read-proxy'),
  verification_state: known('EVIDENCE', 'READ_VALIDATED'),
})

const finding = view('FINDING', {
  reader_id: known('EVIDENCE', 'github_branch_reader'),
  claim: known('EVIDENCE', 'default branch is main'),
  observation_id: known('EVIDENCE', 'OBS-42'),
  evidence: known('EVIDENCE', evidence),
  provenance: known('EVIDENCE', provenance),
  classification: unknown('EVIDENCE', 'NO_AUTHORITATIVE_FINDING_CLASSIFICATION'),
})

const snapshot: OperationsSnapshot = {
  evidence: [evidence],
  findings: [finding],
  plan: view('PLAN', {
    order_id: known('WORK_ORDER', 'WO-42'),
    action: known('WORK_ORDER', 'git_commit'),
    target: known('WORK_ORDER', 'docs/example.md'),
    expected_effect: known('WORK_ORDER', 'document phase 4.7'),
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
      event_type: known('AUTHORITATIVE', 'SHADOW_PLAN_CREATED'),
      created_at: known('AUTHORITATIVE', '2026-09-16T19:03:00+00:00'),
      prev_hash: known('AUTHORITATIVE', 'prev-7'),
      event_hash: known('AUTHORITATIVE', 'event-7'),
      payload: unknown('AUTHORITATIVE', 'RAW_AUDIT_PAYLOAD_NOT_UI_SAFE'),
    }),
  ],
}

describe('Phase 4.7 Evidence & Audit', () => {
  it('fails closed while keeping every required surface visible without authority', () => {
    renderEvidenceAudit()

    expect(screen.getByRole('heading', { name: 'Evidence & Audit' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('snapshot unavailable')

    for (const regionName of ['Evidence Explorer', 'Verification Records', 'Findings', 'Provenance / Trace Graph', 'Audit Timeline', 'Trace Inspector', 'Future chain']) {
      expect(screen.getByRole('region', { name: regionName })).toBeInTheDocument()
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders backend verification and provenance without inventing missing chain edges', () => {
    renderEvidenceAudit(snapshot)

    const verification = screen.getByRole('region', { name: 'Verification Records' })
    expect(verification).toHaveTextContent('READ_VALIDATED')
    expect(verification).toHaveTextContent('performs no verification')

    const findings = screen.getByRole('region', { name: 'Findings' })
    expect(findings).toHaveTextContent('default branch is main')
    expect(findings).toHaveTextContent('NO_AUTHORITATIVE_FINDING_CLASSIFICATION')

    const graph = screen.getByRole('region', { name: 'Provenance / Trace Graph' })
    expect(graph).toHaveTextContent('NO_EXPLICIT_REQUEST_RELATIONSHIP')
    expect(graph).toHaveTextContent('NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP')
    expect(graph).toHaveTextContent('github_branch_reader')

    const inspector = screen.getByRole('region', { name: 'Trace Inspector' })
    expect(inspector).toHaveTextContent('OBS-42')
    expect(inspector).toHaveTextContent('FRESH')
    expect(inspector).toHaveTextContent('No standalone TRACE contract exists')
  })

  it('keeps raw Audit payload unavailable and does not locally validate hash-chain fields', () => {
    renderEvidenceAudit(snapshot)

    const audit = screen.getByRole('region', { name: 'Audit Timeline' })
    expect(audit).toHaveTextContent('SHADOW_PLAN_CREATED')
    expect(within(audit).getByText('UNKNOWN')).toBeInTheDocument()
    expect(audit).toHaveTextContent('RAW_AUDIT_PAYLOAD_NOT_UI_SAFE')
    expect(audit).toHaveTextContent('does not verify the Audit chain')
  })

  it('keeps the future write chain structural and non-operative', () => {
    renderEvidenceAudit(snapshot)

    const future = screen.getByRole('region', { name: 'Future chain' })
    expect(future).toHaveTextContent('APPROVAL → CAPABILITY → EXECUTION → POST_VERIFY')
    expect(future).toHaveTextContent('Non-operative')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not synthesize records from explicitly empty backend collections', () => {
    renderEvidenceAudit({ evidence: [], findings: [], audit: [] })
    expect(screen.getAllByText('0 backend-reported records.')).toHaveLength(6)
  })
})
