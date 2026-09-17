import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'

function known(source_class: SourceClass, value: unknown): ViewField {
  return { source_class, available: true, value, reason: null }
}

function view(contract: string, fields: Record<string, ViewField>): ViewContract {
  return { contract, fields }
}

export const premiumVisualQaSnapshot: OperationsSnapshot = {
  systemState: view('SYSTEM_STATE', {
    mode: known('AUTHORITATIVE', 'READ_ONLY'),
    writes_enabled: known('AUTHORITATIVE', false),
  }),
  canonicalState: view('CANONICAL_STATE', {
    repository: known('AUTHORITATIVE', 'alpha-phoenix-labs/alpha-agent-orchestrator'),
    branch: known('AUTHORITATIVE', 'phase4/premium-mission-control-remediation'),
    head_sha: known('AUTHORITATIVE', 'VISUAL-QA-FIXTURE'),
    freshness_result: known('AUTHORITATIVE', 'FRESH'),
  }),
  activeWorkOrder: view('WORK_ORDER', {
    order_id: known('WORK_ORDER', 'WO-PREMIUM-QA-004'),
    status: known('WORK_ORDER', 'RUNNING'),
    risk: known('WORK_ORDER', 'LOW'),
    action: known('WORK_ORDER', 'Marktanalyse erneuerbare Energien'),
    target: known('WORK_ORDER', 'mission-control / visual-qa'),
  }),
  lifecycle: view('LIFECYCLE', {
    order_status: known('WORK_ORDER', 'RUNNING'),
    stage: known('WORK_ORDER', 'SWARM_EXECUTION'),
  }),
  findings: [
    view('FINDING', {
      claim: known('EVIDENCE', 'Premium Mission Control wird gegen den visuellen Quality Gate geprüft.'),
      reader_id: known('EVIDENCE', 'reviewer-01'),
      classification: known('EVIDENCE', 'VISUAL_QA_FIXTURE'),
    }),
    view('FINDING', {
      claim: known('EVIDENCE', 'Authority-Darstellung bleibt strikt read-only und fail-closed.'),
      reader_id: known('EVIDENCE', 'security-reviewer'),
      classification: known('EVIDENCE', 'VISUAL_QA_FIXTURE'),
    }),
  ],
  evidence: [
    view('EVIDENCE', {
      source: known('EVIDENCE', 'repository'),
      reference: known('EVIDENCE', 'PHASE_4_PREMIUM_MISSION_CONTROL_VISUAL_CONTRACT'),
      verification_state: known('EVIDENCE', 'READ_VALIDATED'),
    }),
    view('EVIDENCE', {
      source: known('EVIDENCE', 'visual-reference'),
      reference: known('EVIDENCE', 'ALPHAN_PREMIUM_GATE'),
      verification_state: known('EVIDENCE', 'VISUAL_QA_FIXTURE'),
    }),
    view('EVIDENCE', {
      source: known('EVIDENCE', 'ci'),
      reference: known('EVIDENCE', 'premium-mission-control-visual-evidence'),
      verification_state: known('EVIDENCE', 'VISUAL_QA_FIXTURE'),
    }),
  ],
  audit: [
    view('AUDIT_EVENT', {
      seq: known('AUTHORITATIVE', 41),
      event_type: known('AUTHORITATIVE', 'Work Order beobachtet'),
      created_at: known('AUTHORITATIVE', '14:28:04'),
    }),
    view('AUDIT_EVENT', {
      seq: known('AUTHORITATIVE', 42),
      event_type: known('AUTHORITATIVE', 'Analyseplan erstellt'),
      created_at: known('AUTHORITATIVE', '14:28:18'),
    }),
    view('AUDIT_EVENT', {
      seq: known('AUTHORITATIVE', 43),
      event_type: known('AUTHORITATIVE', 'Agenten parallel gestartet'),
      created_at: known('AUTHORITATIVE', '14:29:02'),
    }),
    view('AUDIT_EVENT', {
      seq: known('AUTHORITATIVE', 44),
      event_type: known('AUTHORITATIVE', 'Quellenqualität verifiziert'),
      created_at: known('AUTHORITATIVE', '14:29:23'),
    }),
  ],
  gates: [
    view('GATE', {
      gate_id: known('AUTHORITATIVE', 'PHASE4_READ_ONLY'),
      allowed: known('AUTHORITATIVE', true),
      reason: known('AUTHORITATIVE', 'READ_ONLY_SURFACE'),
    }),
    view('GATE', {
      gate_id: known('AUTHORITATIVE', 'WRITE_OPERATIONS'),
      allowed: known('AUTHORITATIVE', false),
      reason: known('AUTHORITATIVE', 'PHASE5_NOT_ACTIVE'),
    }),
  ],
  locks: [
    view('LOCK', {
      resource: known('AUTHORITATIVE', 'mission-control'),
      owner: known('AUTHORITATIVE', 'visual-qa'),
      order_id: known('AUTHORITATIVE', 'WO-PREMIUM-QA-004'),
    }),
  ],
  writer: view('WRITER', {
    writer_id: known('WORK_ORDER', 'code_writer'),
    proposal_only: known('WORK_ORDER', true),
    runtime_state: known('RUNTIME', 'INACTIVE · PHASE 4'),
  }),
  leader: view('AGENT', {
    agent_id: known('AUTHORITATIVE', 'Leader'),
    role: known('AUTHORITATIVE', 'ORCHESTRATOR'),
    runtime_state: known('RUNTIME', 'RUNNING'),
    activity: known('RUNTIME', 'KOORDINIERT SWARM'),
  }),
  agents: [
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Researcher'),
      role: known('AUTHORITATIVE', 'RESEARCH'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'MARKTDATEN'),
    }),
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Planner'),
      role: known('AUTHORITATIVE', 'PLANNING'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'STRUKTURIERT PLAN'),
    }),
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Analyst'),
      role: known('AUTHORITATIVE', 'ANALYSIS'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'RISIKO-SCAN'),
    }),
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Critic'),
      role: known('AUTHORITATIVE', 'REVIEW'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'QUELLENPRÜFUNG'),
    }),
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Synthesizer'),
      role: known('AUTHORITATIVE', 'SYNTHESIS'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'VERDICHTET ERGEBNISSE'),
    }),
    view('AGENT', {
      agent_id: known('AUTHORITATIVE', 'Reporter'),
      role: known('AUTHORITATIVE', 'REPORTING'),
      health: known('AUTHORITATIVE', 'HEALTHY'),
      runtime_state: known('RUNTIME', 'RUNNING'),
      activity: known('RUNTIME', 'ENTWIRFT BERICHT'),
    }),
  ],
  connectors: [
    view('CONNECTOR', {
      connector_id: known('AUTHORITATIVE', 'Web Search'),
      state: known('RUNTIME', 'AVAILABLE'),
    }),
    view('CONNECTOR', {
      connector_id: known('AUTHORITATIVE', 'Internal Docs'),
      state: known('RUNTIME', 'AVAILABLE'),
    }),
    view('CONNECTOR', {
      connector_id: known('AUTHORITATIVE', 'Code Analysis'),
      state: known('RUNTIME', 'AVAILABLE'),
    }),
    view('CONNECTOR', {
      connector_id: known('AUTHORITATIVE', 'Data Store'),
      state: known('RUNTIME', 'AVAILABLE'),
    }),
    view('CONNECTOR', {
      connector_id: known('AUTHORITATIVE', 'External APIs'),
      state: known('RUNTIME', 'AVAILABLE'),
    }),
  ],
  runtime: view('RUNTIME', {
    state: known('RUNTIME', 'RUNNING'),
    observed_at: known('RUNTIME', '14:29:31'),
  }),
  telemetry: view('TELEMETRY', {
    metrics: known('TELEMETRY', {
      CPU: 32,
      RAM: 48,
      Disk: 22,
      Net: 18,
      'Tokens/s': 73,
    }),
  }),
}
