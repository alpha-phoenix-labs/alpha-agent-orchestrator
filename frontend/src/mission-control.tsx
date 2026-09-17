import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { useOperationsData } from './operations-data'
import {
  ContractList,
  ContractValue,
  MissingAuthority,
  Panel,
  displayValue,
} from './premium-mission-primitives'
import { LeaderChat, TopologyHero } from './premium-mission-topology'

function fieldValue(contract: ViewContract | undefined, field: string, fallback: string): string {
  return displayValue(readAvailableField<unknown>(contract, field), fallback)
}

function FieldWithReason({
  contract,
  field,
}: {
  contract: ViewContract
  field: string
}) {
  const { t } = useI18n()
  const value = fieldValue(contract, field, t('common.unknown'))
  const reason = readUnavailableReason(contract, field)

  return (
    <div className="alphan-table-value">
      <span>{value}</span>
      {reason ? <small>{reason}</small> : null}
    </div>
  )
}

function AgentGrid({ agents }: { agents?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t('system.agentGrid')} eyebrow="AGENT GRID" className="alphan-agent-grid-panel">
      {!agents ? (
        <MissingAuthority message={t('system.noAgentsForGrid')} compact />
      ) : agents.length === 0 ? (
        <p className="alphan-empty">{t('common.backendRecordsZero')}</p>
      ) : (
        <div className="alphan-agent-table" role="table" aria-label={t('system.agentGrid')}>
          <div className="alphan-agent-table-head" role="row">
            <span>{t('field.agent')}</span>
            <span>{t('field.role')}</span>
            <span>{t('field.health')}</span>
            <span>{t('field.runtimeState')}</span>
            <span>{t('field.activity')}</span>
          </div>
          <div className="alphan-agent-table-body">
            {agents.slice(0, 10).map((agent, index) => (
              <div className="alphan-agent-row" role="row" key={index}>
                <div className="alphan-agent-identity">
                  <span className="alphan-mini-orb" aria-hidden="true">A</span>
                  <FieldWithReason contract={agent} field="agent_id" />
                </div>
                <FieldWithReason contract={agent} field="role" />
                <FieldWithReason contract={agent} field="health" />
                <FieldWithReason contract={agent} field="runtime_state" />
                <FieldWithReason contract={agent} field="activity" />
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="alphan-panel-note">{t('system.agentSeparationNote')}</p>
    </Panel>
  )
}

function LifecyclePanel({
  lifecycle,
  workOrder,
}: {
  lifecycle?: ViewContract
  workOrder?: ViewContract
}) {
  const { t } = useI18n()

  return (
    <Panel title={t('mission.lifecycle')} eyebrow="WORK ORDER LIFECYCLE" className="alphan-lifecycle-panel">
      <div className="alphan-lifecycle-visual">
        <span className="alphan-lifecycle-line" aria-hidden="true" />
        <div className="alphan-lifecycle-step">
          <span className="alphan-lifecycle-dot" aria-hidden="true" />
          <ContractValue contract={workOrder} field="status" label={t('field.orderStatus')} compact />
        </div>
        <div className="alphan-lifecycle-step">
          <span className="alphan-lifecycle-dot alphan-lifecycle-dot--violet" aria-hidden="true" />
          <ContractValue contract={lifecycle} field="stage" label={t('field.lifecycleStage')} compact />
        </div>
      </div>
      {!lifecycle ? <MissingAuthority message={t('mission.noLifecycle')} compact /> : null}
      <p className="alphan-panel-note">{t('work.lifecycleNote')}</p>
    </Panel>
  )
}

function ControlRail({ snapshot }: { snapshot: ReturnType<typeof useOperationsData>['snapshot'] }) {
  const { t } = useI18n()
  const telemetryMetrics = readAvailableField<unknown>(snapshot?.telemetry, 'metrics')
  const metrics =
    telemetryMetrics && typeof telemetryMetrics === 'object' && !Array.isArray(telemetryMetrics)
      ? Object.entries(telemetryMetrics as Record<string, unknown>).slice(0, 5)
      : []

  return (
    <aside aria-label={t('mission.rail')} className="alphan-control-rail">
      <div className="alphan-rail-header">
        <div>
          <span>CONTROL RAIL</span>
          <strong>{t('mission.rail')}</strong>
        </div>
        <span className="alphan-readonly-lock">STRICT READ ONLY</span>
      </div>

      <Panel title={t('app.systemMode')} eyebrow="AUTHORITY" className="alphan-rail-panel">
        {snapshot?.systemState ? (
          <div className="alphan-rail-pairs">
            <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} compact />
            <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} compact />
          </div>
        ) : (
          <MissingAuthority message={t('system.noSystemState')} compact />
        )}
      </Panel>

      <Panel title={t('mission.canonicalState')} eyebrow="CANONICAL STATE" className="alphan-rail-panel">
        {snapshot?.canonicalState ? (
          <div className="alphan-rail-stack">
            <ContractValue contract={snapshot.canonicalState} field="repository" label={t('app.repository')} compact />
            <div className="alphan-rail-pairs">
              <ContractValue contract={snapshot.canonicalState} field="branch" label={t('field.branch')} compact />
              <ContractValue contract={snapshot.canonicalState} field="head_sha" label={t('field.head')} compact />
            </div>
            <ContractValue contract={snapshot.canonicalState} field="freshness_result" label={t('field.freshness')} compact />
          </div>
        ) : (
          <MissingAuthority message={t('mission.canonicalUnavailable')} compact />
        )}
      </Panel>

      <Panel title={t('mission.activeWorkOrder')} eyebrow="ACTIVE WORK ORDER" className="alphan-rail-panel">
        {snapshot?.activeWorkOrder ? (
          <div className="alphan-rail-stack">
            <ContractValue contract={snapshot.activeWorkOrder} field="order_id" label={t('field.orderId')} compact />
            <div className="alphan-rail-pairs">
              <ContractValue contract={snapshot.activeWorkOrder} field="status" label={t('field.status')} compact />
              <ContractValue contract={snapshot.activeWorkOrder} field="risk" label={t('field.risk')} compact />
            </div>
            <ContractValue contract={snapshot.activeWorkOrder} field="action" label={t('field.action')} compact />
            <ContractValue contract={snapshot.activeWorkOrder} field="target" label={t('field.target')} compact />
          </div>
        ) : (
          <MissingAuthority message={t('mission.noActiveWorkOrder')} compact />
        )}
      </Panel>

      <Panel title={t('mission.gates')} eyebrow="SAFETY GATES" className="alphan-rail-panel">
        <ContractList
          contracts={snapshot?.gates}
          emptyMessage={t('mission.noGates')}
          className="alphan-rail-list"
          render={(gate, index) => (
            <div className="alphan-rail-record" key={index}>
              <ContractValue contract={gate} field="gate_id" label={t('field.gate')} compact />
              <div className="alphan-rail-pairs">
                <ContractValue contract={gate} field="allowed" label={t('field.allowed')} compact />
                <ContractValue contract={gate} field="reason" label={t('field.reason')} compact />
              </div>
            </div>
          )}
        />
      </Panel>

      <Panel title={t('mission.locks')} eyebrow="LOCKS" className="alphan-rail-panel">
        <ContractList
          contracts={snapshot?.locks}
          emptyMessage={t('mission.noLocks')}
          className="alphan-rail-list"
          render={(lock, index) => (
            <div className="alphan-rail-record" key={index}>
              <ContractValue contract={lock} field="resource" label={t('field.resource')} compact />
              <div className="alphan-rail-pairs">
                <ContractValue contract={lock} field="owner" label={t('field.owner')} compact />
                <ContractValue contract={lock} field="order_id" label={t('field.orderId')} compact />
              </div>
            </div>
          )}
        />
      </Panel>

      <Panel title={t('mission.writerStatus')} eyebrow="WRITER BOUNDARY" className="alphan-rail-panel">
        {snapshot?.writer ? (
          <div className="alphan-rail-stack">
            <ContractValue contract={snapshot.writer} field="writer_id" label={t('field.writer')} compact />
            <ContractValue contract={snapshot.writer} field="proposal_only" label={t('field.proposalOnly')} compact />
            <ContractValue contract={snapshot.writer} field="runtime_state" label={t('field.runtimeState')} compact />
          </div>
        ) : (
          <MissingAuthority message={t('mission.noWriter')} compact />
        )}
      </Panel>

      <Panel title={t('mission.blockers')} eyebrow="BLOCKERS" className="alphan-rail-panel">
        <MissingAuthority message={t('mission.noBlockers')} compact />
      </Panel>

      <section className="alphan-runtime-card" aria-label="Runtime and telemetry">
        <div className="alphan-runtime-heading">
          <span>RUNTIME / TELEMETRY</span>
          <strong>TELEMETRY ≠ AUTHORITY</strong>
        </div>
        {snapshot?.runtime ? (
          <div className="alphan-runtime-pairs">
            <ContractValue contract={snapshot.runtime} field="state" label={t('field.runtimeState')} compact />
            <ContractValue contract={snapshot.runtime} field="observed_at" label={t('field.runtimeObservedAt')} compact />
          </div>
        ) : (
          <MissingAuthority message={t('system.noRuntime')} compact />
        )}
        <div className="alphan-metric-list">
          {metrics.length === 0 ? (
            <MissingAuthority message={t('system.noTelemetry')} compact />
          ) : (
            metrics.map(([key, value]) => {
              const numeric = typeof value === 'number' && Number.isFinite(value)
              const width = numeric ? Math.max(4, Math.min(100, Math.abs(value))) : 0
              return (
                <div className="alphan-metric-row" key={key}>
                  <div>
                    <span>{key}</span>
                    <strong>{displayValue(value, t('common.unknown'))}</strong>
                  </div>
                  <span className="alphan-metric-track" aria-hidden="true">
                    {numeric ? <span style={{ width: `${width}%` }} /> : null}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>
    </aside>
  )
}

function RecentEvents({ events }: { events?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t('evidence.auditTimeline')} eyebrow="RECENT EVENTS" className="alphan-bottom-panel">
      <ContractList
        contracts={events}
        emptyMessage={t('evidence.noAudit')}
        className="alphan-event-list"
        render={(event, index) => (
          <div className="alphan-event-row" key={index}>
            <span>{fieldValue(event, 'created_at', t('common.unknown'))}</span>
            <strong>{fieldValue(event, 'event_type', t('common.unknown'))}</strong>
            <small>#{fieldValue(event, 'seq', t('common.unknown'))}</small>
          </div>
        )}
      />
      <p className="alphan-panel-note">{t('evidence.auditNote')}</p>
    </Panel>
  )
}

function TraceScaffold() {
  const { t } = useI18n()
  const stages = [
    t('trace.route'),
    t('trace.read'),
    t('trace.verify'),
    t('trace.plan'),
    t('trace.humanGate'),
    t('trace.execution'),
    t('trace.postVerify'),
  ]

  return (
    <Panel title={t('trace.title')} eyebrow="TRACE / WATERFALL" className="alphan-bottom-panel alphan-trace-panel">
      <div className="alphan-trace-scale" aria-hidden="true">
        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
      <div className="alphan-trace-rows">
        {stages.map((stage, index) => (
          <div className="alphan-trace-row" key={stage}>
            <span>{stage}</span>
            <div className="alphan-trace-track" aria-hidden="true">
              <i style={{ left: `${index * 9}%` }} />
            </div>
            <strong>{t('common.unavailable')}</strong>
          </div>
        ))}
      </div>
      <p className="alphan-panel-note">{t('trace.boundaryNote')}</p>
    </Panel>
  )
}

function EvidenceSummary({
  evidence,
  findings,
}: {
  evidence?: readonly ViewContract[]
  findings?: readonly ViewContract[]
}) {
  const { t } = useI18n()

  return (
    <Panel title={t('mission.evidenceSummary')} eyebrow="EVIDENCE & AUDIT" className="alphan-bottom-panel">
      <div className="alphan-evidence-counts">
        <div><span>EVIDENCE</span><strong>{evidence?.length ?? t('common.unknown')}</strong></div>
        <div><span>FINDINGS</span><strong>{findings?.length ?? t('common.unknown')}</strong></div>
      </div>
      <div className="alphan-count-label">
        {t('common.backendReferencesCount', { count: evidence?.length ?? t('common.unknown') })}
      </div>
      <ContractList
        contracts={evidence}
        emptyMessage={t('mission.noEvidence')}
        className="alphan-evidence-list"
        render={(item, index) => (
          <div className="alphan-evidence-row" key={index}>
            <span>{fieldValue(item, 'source', t('common.unknown'))}</span>
            <strong>{fieldValue(item, 'reference', t('common.unknown'))}</strong>
            <small>{fieldValue(item, 'verification_state', t('common.unknown'))}</small>
          </div>
        )}
      />
      <p className="alphan-panel-note">{t('mission.evidenceNote')}</p>
    </Panel>
  )
}

function FindingsPanel({ findings }: { findings?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t('mission.currentFindings')} eyebrow="EVIDENCE SIGNALS" className="alphan-findings-panel">
      <div className="alphan-count-label">
        {t('common.backendRecordsCount', { count: findings?.length ?? t('common.unknown') })}
      </div>
      <ContractList
        contracts={findings}
        emptyMessage={t('mission.noFindings')}
        className="alphan-finding-list"
        render={(finding, index) => (
          <div className="alphan-finding-row" key={index}>
            <strong>{fieldValue(finding, 'claim', t('common.unknown'))}</strong>
            <span>{fieldValue(finding, 'reader_id', t('common.unknown'))}</span>
            <small>{fieldValue(finding, 'classification', t('common.unknown'))}</small>
          </div>
        )}
      />
    </Panel>
  )
}

export function MissionControl() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()
  const mode = fieldValue(snapshot?.systemState, 'mode', t('common.unknown'))
  const orderId = fieldValue(snapshot?.activeWorkOrder, 'order_id', t('common.unknown'))

  return (
    <div className="alphan-console">
      <header className="alphan-mission-header">
        <div>
          <p>ALPHAN · MULTI-AGENT INTELLIGENCE</p>
          <div className="alphan-mission-title-row">
            <h2>{t('mission.title')}</h2>
            <span className="alphan-live-chip">READ ONLY</span>
          </div>
          <span>{t('mission.description')}</span>
        </div>
        <div className="alphan-header-status">
          <div>
            <span>{t('common.authority')}</span>
            <strong>{authorityAvailable ? t('common.available') : t('common.unavailable')}</strong>
          </div>
          <div>
            <span>{t('app.systemMode')}</span>
            <strong>{mode}</strong>
          </div>
          <div>
            <span>{t('mission.activeWorkOrder')}</span>
            <strong>{orderId}</strong>
          </div>
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="alphan-authority-banner">
          <span className="alphan-status-dot alphan-status-dot--warning" aria-hidden="true" />
          <span>{t('mission.authorityUnavailable')}</span>
        </div>
      ) : null}

      <div className="alphan-dashboard-grid">
        <div className="alphan-leader-stack">
          <LeaderChat leader={snapshot?.leader} />
          <FindingsPanel findings={snapshot?.findings} />
        </div>

        <div className="alphan-topology-area">
          <TopologyHero leader={snapshot?.leader} agents={snapshot?.agents} connectors={snapshot?.connectors} />
        </div>

        <div className="alphan-middle-grid">
          <AgentGrid agents={snapshot?.agents} />
          <LifecyclePanel lifecycle={snapshot?.lifecycle} workOrder={snapshot?.activeWorkOrder} />
        </div>

        <ControlRail snapshot={snapshot} />

        <div className="alphan-bottom-grid">
          <RecentEvents events={snapshot?.audit} />
          <TraceScaffold />
          <EvidenceSummary evidence={snapshot?.evidence} findings={snapshot?.findings} />
        </div>
      </div>

      <footer className="alphan-footer">
        <span>ALPHAN · PRIVATE DEVELOPMENT · PHASE 4</span>
        <span>STRICT READ ONLY · TELEMETRY ≠ AUTHORITY</span>
      </footer>
    </div>
  )
}
