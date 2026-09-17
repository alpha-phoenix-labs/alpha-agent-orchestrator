import type { ReactNode } from 'react'

import { ShellErrorBoundary } from './app-shell'
import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { useOperationsData } from './operations-data'

function displayValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function ContractValue({
  contract,
  field,
  label,
  compact = false,
}: {
  contract?: ViewContract
  field: string
  label: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)
  const formattedValue =
    typeof value === 'boolean'
      ? value
        ? t('common.true')
        : t('common.false')
      : displayValue(value, t('common.unknown'))

  return (
    <div className={`mission-data-cell ${compact ? 'mission-data-cell--compact' : ''}`}>
      <span className="mission-data-label">{label}</span>
      <span className="mission-data-value">{formattedValue}</span>
      {reason ? <span className="mission-data-reason">{reason}</span> : null}
    </div>
  )
}

function Panel({
  title,
  children,
  className = '',
  eyebrow,
}: {
  title: string
  children: ReactNode
  className?: string
  eyebrow?: string
}) {
  const { t } = useI18n()
  return (
    <section aria-label={title} className={`mission-panel ${className}`}>
      <div className="mission-panel-heading">
        <div>
          {eyebrow ? <p className="mission-panel-eyebrow">{eyebrow}</p> : null}
          <h3 className="mission-panel-title">{title}</h3>
        </div>
        <span className="mission-panel-rule" aria-hidden="true" />
      </div>
      <div className="mission-panel-body">
        <ShellErrorBoundary
          errorTitle={t('app.viewUnavailable')}
          errorDetail={t('app.viewUnavailableDetail')}
        >
          {children}
        </ShellErrorBoundary>
      </div>
    </section>
  )
}

function MissingAuthority({ message, compact = false }: { message: string; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className={`mission-unavailable ${compact ? 'mission-unavailable--compact' : ''}`}>
      <div className="mission-unavailable-title">
        <span className="mission-state-dot mission-state-dot--warning" aria-hidden="true" />
        <strong>{t('common.unavailable')}</strong>
      </div>
      <p>{message}</p>
    </div>
  )
}

function ContractList({
  contracts,
  emptyMessage,
  render,
  className = 'space-y-3',
}: {
  contracts: readonly ViewContract[] | undefined
  emptyMessage: string
  render: (contract: ViewContract, index: number) => ReactNode
  className?: string
}) {
  const { t } = useI18n()
  if (!contracts) {
    return <MissingAuthority message={emptyMessage} />
  }

  if (contracts.length === 0) {
    return <p className="text-sm text-slate-400">{t('common.backendRecordsZero')}</p>
  }

  return <div className={className}>{contracts.map(render)}</div>
}

function TopologyNode({ contract, leader = false }: { contract: ViewContract; leader?: boolean }) {
  const { t } = useI18n()
  const agent = displayValue(readAvailableField<unknown>(contract, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(contract, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(contract, 'runtime_state'), t('common.unknown'))
  const activity = displayValue(readAvailableField<unknown>(contract, 'activity'), t('common.unknown'))

  return (
    <div
      className={`mission-topology-node ${leader ? 'mission-topology-node--leader' : ''}`}
      tabIndex={0}
      aria-label={`${t('field.agent')}: ${agent}`}
    >
      <div className="mission-node-kicker">{leader ? t('system.leaderNode') : t('field.agentNode')}</div>
      <div className="mission-node-name">{agent}</div>
      <div className="mission-node-role">{role}</div>
      <div className="mission-node-status-grid">
        <span>
          <small>{t('field.runtimeState')}</small>
          <b>{runtime}</b>
        </span>
        <span>
          <small>{t('field.activity')}</small>
          <b>{activity}</b>
        </span>
      </div>
    </div>
  )
}

function TopologyHero({ leader, agents }: { leader?: ViewContract; agents?: readonly ViewContract[] }) {
  const { t } = useI18n()
  const visibleAgents = agents?.slice(0, 8)

  return (
    <section aria-label={t('system.liveTopology')} className="mission-topology-hero">
      <div className="mission-topology-header">
        <div>
          <p className="mission-panel-eyebrow">{t('common.phase49ReadOnlyTopology')}</p>
          <h3>{t('system.liveTopology')}</h3>
          <p>{t('system.topologyNote')}</p>
        </div>
        <div className="mission-source-badges" aria-label="Source classes">
          <span>AUTHORITATIVE</span>
          <span>RUNTIME</span>
          <span>TELEMETRY</span>
        </div>
      </div>

      <div className="mission-topology-stage">
        <div className="mission-topology-orbit mission-topology-orbit--outer" aria-hidden="true" />
        <div className="mission-topology-orbit mission-topology-orbit--inner" aria-hidden="true" />
        <div className="mission-topology-axis mission-topology-axis--x" aria-hidden="true" />
        <div className="mission-topology-axis mission-topology-axis--y" aria-hidden="true" />

        <div className="mission-topology-leader">
          {leader ? <TopologyNode contract={leader} leader /> : <MissingAuthority message={t('system.noLeaderNode')} compact />}
        </div>

        <div className="mission-topology-agents">
          {!visibleAgents ? (
            <MissingAuthority message={t('system.noAgentsForTopology')} compact />
          ) : visibleAgents.length === 0 ? (
            <p className="text-sm text-slate-400">{t('common.backendRecordsZero')}</p>
          ) : (
            visibleAgents.map((agent, index) => <TopologyNode key={index} contract={agent} />)
          )}
        </div>
      </div>

      <div className="mission-topology-footer">
        <div className="mission-topology-relationship-note">
          <span className="mission-state-dot mission-state-dot--warning" aria-hidden="true" />
          <span>{t('system.noActivityEdge')}</span>
        </div>
        <p>{t('system.topologySafety')}</p>
      </div>
    </section>
  )
}

function RailMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mission-rail-metric">
      <span className="mission-data-label">{label}</span>
      <div>{children}</div>
    </div>
  )
}

export function MissionControl() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()
  const evidenceCount = snapshot?.evidence?.length
  const findingCount = snapshot?.findings?.length
  const mode = displayValue(readAvailableField<unknown>(snapshot?.systemState, 'mode'), t('common.unknown'))
  const orderId = displayValue(readAvailableField<unknown>(snapshot?.activeWorkOrder, 'order_id'), t('common.unknown'))

  return (
    <div className="mission-control-shell">
      <header className="mission-command-header">
        <div className="mission-command-copy">
          <p className="mission-command-kicker">{t('common.phase45ReadOnly')}</p>
          <div className="mission-command-title-row">
            <h2>{t('mission.title')}</h2>
            <span className="mission-readonly-chip">READ ONLY</span>
          </div>
          <p>{t('mission.description')}</p>
        </div>
        <div className="mission-command-context">
          <div className={`mission-authority-badge ${authorityAvailable ? 'mission-authority-badge--available' : 'mission-authority-badge--unavailable'}`}>
            <span className={`mission-state-dot ${authorityAvailable ? 'mission-state-dot--available' : 'mission-state-dot--warning'}`} aria-hidden="true" />
            <span>{t('common.authority')}</span>
            <strong>{authorityAvailable ? t('common.available') : t('common.unavailable')}</strong>
          </div>
          <div className="mission-context-chip">
            <span>{t('app.systemMode')}</span>
            <b>{mode}</b>
          </div>
          <div className="mission-context-chip">
            <span>{t('mission.activeWorkOrder')}</span>
            <b>{orderId}</b>
          </div>
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="mission-authority-banner">
          <span className="mission-state-dot mission-state-dot--warning" aria-hidden="true" />
          <span>{t('mission.authorityUnavailable')}</span>
        </div>
      ) : null}

      <div className="mission-console-grid">
        <div className="mission-leader-zone">
          <Panel title={t('mission.leaderInteraction')} className="mission-panel--leader" eyebrow="ORCHESTRATION">
            {snapshot?.leader ? (
              <div className="space-y-4">
                <div className="mission-leader-identity">
                  <div className="mission-leader-orb" aria-hidden="true">
                    <span />
                  </div>
                  <div className="min-w-0">
                    <p className="mission-data-label">{t('system.leaderNode')}</p>
                    <p className="mission-leader-name">
                      {displayValue(readAvailableField<unknown>(snapshot.leader, 'agent_id'), t('common.unknown'))}
                    </p>
                    <p className="mission-leader-role">
                      {displayValue(readAvailableField<unknown>(snapshot.leader, 'role'), t('common.unknown'))}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <ContractValue contract={snapshot.leader} field="runtime_state" label={t('field.runtimeState')} compact />
                  <ContractValue contract={snapshot.leader} field="activity" label={t('field.activity')} compact />
                </div>
                <MissingAuthority message={t('mission.noInteractionHistory')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noLeader')} />
            )}
          </Panel>

          <Panel title={t('mission.lifecycle')} eyebrow="WORK ORDER FLOW">
            {snapshot?.lifecycle ? (
              <div className="mission-lifecycle-stack">
                <ContractValue contract={snapshot.lifecycle} field="order_status" label={t('field.orderStatus')} compact />
                <div className="mission-lifecycle-connector" aria-hidden="true" />
                <ContractValue contract={snapshot.lifecycle} field="stage" label={t('field.lifecycleStage')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noLifecycle')} />
            )}
          </Panel>

          <Panel title={t('mission.currentFindings')} eyebrow="EVIDENCE SIGNALS">
            <div className="mission-count-row">
              <span>{t('common.backendRecordsCount', { count: findingCount ?? t('common.unknown') })}</span>
            </div>
            <ContractList
              contracts={snapshot?.findings}
              emptyMessage={t('mission.noFindings')}
              className="mission-scroll-stack"
              render={(finding, index) => (
                <article key={index} className="mission-mini-record">
                  <ContractValue contract={finding} field="claim" label={t('field.claim')} compact />
                  <ContractValue contract={finding} field="classification" label={t('field.classification')} compact />
                </article>
              )}
            />
          </Panel>
        </div>

        <div className="mission-operational-zone">
          <TopologyHero leader={snapshot?.leader} agents={snapshot?.agents} />

          <Panel title={t('system.agentGrid')} eyebrow="SWARM MATRIX" className="mission-panel--matrix">
            <ContractList
              contracts={snapshot?.agents}
              emptyMessage={t('system.noAgentsForGrid')}
              className="mission-agent-grid"
              render={(agent, index) => (
                <article key={index} className="mission-agent-card">
                  <div className="mission-agent-card-header">
                    <div>
                      <p className="mission-data-label">{t('field.agent')}</p>
                      <strong>{displayValue(readAvailableField<unknown>(agent, 'agent_id'), t('common.unknown'))}</strong>
                    </div>
                    <span>{displayValue(readAvailableField<unknown>(agent, 'role'), t('common.unknown'))}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <ContractValue contract={agent} field="health" label={t('field.health')} compact />
                    <ContractValue contract={agent} field="runtime_state" label={t('field.runtimeState')} compact />
                    <ContractValue contract={agent} field="activity" label={t('field.activity')} compact />
                  </div>
                </article>
              )}
            />
            <p className="mission-panel-note">{t('system.globalTelemetryNote')}</p>
          </Panel>

          <div className="mission-intelligence-grid">
            <Panel title={t('mission.evidenceSummary')} eyebrow="EVIDENCE">
              <div className="mission-count-row">
                <span>{t('common.backendReferencesCount', { count: evidenceCount ?? t('common.unknown') })}</span>
              </div>
              <ContractList
                contracts={snapshot?.evidence}
                emptyMessage={t('mission.noEvidence')}
                className="mission-scroll-stack"
                render={(evidence, index) => (
                  <article key={index} className="mission-mini-record mission-mini-record--columns">
                    <ContractValue contract={evidence} field="source" label={t('field.source')} compact />
                    <ContractValue contract={evidence} field="reference" label={t('field.reference')} compact />
                    <ContractValue contract={evidence} field="verification_state" label={t('field.verificationState')} compact />
                  </article>
                )}
              />
              <p className="mission-panel-note">{t('mission.evidenceNote')}</p>
            </Panel>

            <Panel title={t('evidence.auditTimeline')} eyebrow="RECENT EVENTS">
              <ContractList
                contracts={snapshot?.audit}
                emptyMessage={t('evidence.noAudit')}
                className="mission-scroll-stack"
                render={(event, index) => (
                  <article key={index} className="mission-event-record">
                    <div className="mission-event-sequence">
                      <span>{t('field.sequence')}</span>
                      <b>{displayValue(readAvailableField<unknown>(event, 'seq'), t('common.unknown'))}</b>
                    </div>
                    <div className="min-w-0">
                      <p>{displayValue(readAvailableField<unknown>(event, 'event_type'), t('common.unknown'))}</p>
                      <span>{displayValue(readAvailableField<unknown>(event, 'created_at'), t('common.unknown'))}</span>
                    </div>
                  </article>
                )}
              />
              <p className="mission-panel-note">{t('evidence.auditNote')}</p>
            </Panel>
          </div>
        </div>

        <aside aria-label={t('mission.rail')} className="mission-control-rail">
          <div className="mission-rail-heading">
            <div>
              <p>CONTROL PLANE</p>
              <h3>{t('mission.rail')}</h3>
            </div>
            <span className="mission-rail-spine" aria-hidden="true" />
          </div>

          <Panel title={t('app.systemMode')} eyebrow="01 · AUTHORITY" className="mission-panel--rail">
            {snapshot?.systemState ? (
              <div className="space-y-2">
                <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} compact />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noSystemState')} compact />
            )}
          </Panel>

          <Panel title={t('mission.canonicalState')} eyebrow="02 · SOURCE OF TRUTH" className="mission-panel--rail">
            {snapshot?.canonicalState ? (
              <div className="space-y-2">
                <ContractValue contract={snapshot.canonicalState} field="repository" label={t('app.repository')} compact />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <ContractValue contract={snapshot.canonicalState} field="branch" label={t('field.branch')} compact />
                  <ContractValue contract={snapshot.canonicalState} field="head_sha" label={t('field.head')} compact />
                </div>
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label={t('field.freshness')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('mission.canonicalUnavailable')} compact />
            )}
          </Panel>

          <Panel title={t('mission.activeWorkOrder')} eyebrow="03 · CURRENT CONTEXT" className="mission-panel--rail">
            {snapshot?.activeWorkOrder ? (
              <div className="space-y-2">
                <ContractValue contract={snapshot.activeWorkOrder} field="order_id" label={t('field.orderId')} compact />
                <ContractValue contract={snapshot.activeWorkOrder} field="status" label={t('field.status')} compact />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <ContractValue contract={snapshot.activeWorkOrder} field="risk" label={t('field.risk')} compact />
                  <ContractValue contract={snapshot.activeWorkOrder} field="action" label={t('field.action')} compact />
                </div>
                <ContractValue contract={snapshot.activeWorkOrder} field="target" label={t('field.target')} compact />
                <ContractValue contract={snapshot.activeWorkOrder} field="base_state_version" label={t('field.baseState')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noActiveWorkOrder')} compact />
            )}
          </Panel>

          <Panel title={t('mission.gates')} eyebrow="04 · GATES" className="mission-panel--rail">
            <ContractList
              contracts={snapshot?.gates}
              emptyMessage={t('mission.noGates')}
              className="mission-rail-list"
              render={(gate, index) => (
                <article key={index} className="mission-rail-record">
                  <ContractValue contract={gate} field="gate_id" label={t('field.gate')} compact />
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <ContractValue contract={gate} field="allowed" label={t('field.allowed')} compact />
                    <ContractValue contract={gate} field="reason" label={t('field.reason')} compact />
                  </div>
                </article>
              )}
            />
          </Panel>

          <Panel title={t('mission.locks')} eyebrow="05 · LOCKS" className="mission-panel--rail">
            <ContractList
              contracts={snapshot?.locks}
              emptyMessage={t('mission.noLocks')}
              className="mission-rail-list"
              render={(lock, index) => (
                <article key={index} className="mission-rail-record">
                  <ContractValue contract={lock} field="resource" label={t('field.resource')} compact />
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <ContractValue contract={lock} field="owner" label={t('field.owner')} compact />
                    <ContractValue contract={lock} field="order_id" label={t('field.orderId')} compact />
                  </div>
                </article>
              )}
            />
          </Panel>

          <Panel title={t('mission.writerStatus')} eyebrow="06 · WRITER BOUNDARY" className="mission-panel--rail">
            {snapshot?.writer ? (
              <div className="space-y-2">
                <ContractValue contract={snapshot.writer} field="writer_id" label={t('field.writer')} compact />
                <ContractValue contract={snapshot.writer} field="proposal_only" label={t('field.proposalOnly')} compact />
                <ContractValue contract={snapshot.writer} field="runtime_state" label={t('field.runtimeState')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noWriter')} compact />
            )}
          </Panel>

          <Panel title={t('mission.blockers')} eyebrow="07 · BLOCKERS" className="mission-panel--rail">
            <MissingAuthority message={t('mission.noBlockers')} compact />
          </Panel>

          <RailMetric label={t('field.observedAt')}>
            <span className="mission-rail-observed">
              {displayValue(readAvailableField<unknown>(snapshot?.canonicalState, 'observed_at'), t('common.unknown'))}
            </span>
          </RailMetric>
        </aside>
      </div>
    </div>
  )
}
