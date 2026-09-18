import type { ViewContract } from './contracts'
import { useI18n } from './i18n'
import { useOperationsData } from './operations-data'
import { LiveSwarmTopology } from './live-swarm-topology'
import { ContractList, ContractValue, MissingAuthority, Panel } from './premium-mission-primitives'

function AgentCards({ agents }: { agents?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <ContractList
      contracts={agents}
      emptyMessage={t('system.noAgents')}
      className="alpha-swarm-list"
      render={(agent, index) => (
        <article key={index} className="alpha-swarm-record">
          <div className="alpha-swarm-record-grid alpha-swarm-record-grid--agents">
            <ContractValue contract={agent} field="agent_id" label={t('field.agent')} compact />
            <ContractValue contract={agent} field="role" label={t('field.role')} compact />
            <ContractValue contract={agent} field="health" label={t('field.health')} compact />
            <ContractValue contract={agent} field="runtime_state" label={t('field.runtimeState')} compact />
            <ContractValue contract={agent} field="activity" label={t('field.activity')} compact />
          </div>
          <MissingAuthority message={t('system.agentTelemetryUnavailable')} compact />
        </article>
      )}
    />
  )
}

function AgentGrid({ agents }: { agents?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t('system.agentGrid')} eyebrow="AGENT GRID" className="alpha-system-agent-grid">
      <p className="alpha-panel-note alpha-panel-note--lead">{t('system.agentGridNote')}</p>
      <ContractList
        contracts={agents}
        emptyMessage={t('system.noAgentsForGrid')}
        className="alpha-swarm-list"
        render={(agent, index) => (
          <article key={index} className="alpha-swarm-record">
            <div className="alpha-swarm-record-grid alpha-swarm-record-grid--grid">
              <ContractValue contract={agent} field="agent_id" label={t('field.agent')} compact />
              <ContractValue contract={agent} field="role" label={t('field.role')} compact />
              <ContractValue contract={agent} field="health" label={t('field.health')} compact />
              <ContractValue contract={agent} field="runtime_state" label={t('field.runtimeState')} compact />
              <ContractValue contract={agent} field="activity" label={t('field.activity')} compact />
              <MissingAuthority message="NO_AGENT_WORK_ORDER_ASSOCIATION_CONTRACT" compact />
              <MissingAuthority message="NO_PER_AGENT_LATENCY_CONTRACT" compact />
              <MissingAuthority message="NO_PER_AGENT_TOKENS_RATE_CONTRACT" compact />
              <MissingAuthority message="NO_PER_AGENT_CONTEXT_USAGE_CONTRACT" compact />
            </div>
          </article>
        )}
      />
      <p className="alpha-panel-note">{t('system.globalTelemetryNote')}</p>
    </Panel>
  )
}

export function SystemSwarm() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()

  return (
    <div className="alpha-system-swarm">
      <header className="alpha-system-header">
        <div>
          <p>{t('common.phase48ReadOnly')}</p>
          <h2>{t('system.title')}</h2>
          <span>{t('system.description')}</span>
        </div>
        <span className="alpha-readonly-lock">
          {t('common.authority')} · {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </span>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="alpha-authority-banner">
          <span className="alpha-status-dot alpha-status-dot--warning" aria-hidden="true" />
          <span>{t('system.authorityUnavailable')}</span>
        </div>
      ) : null}

      <div className="alpha-system-grid">
        <Panel title={t('system.overview')} eyebrow="SYSTEM OVERVIEW" className="alpha-system-overview">
          <div className="alpha-swarm-stack">
            {snapshot?.systemState ? (
              <div className="alpha-system-facts alpha-system-facts--three">
                <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} compact />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} compact />
                <ContractValue contract={snapshot.systemState} field="state_version" label={t('field.stateVersion')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noSystemState')} />
            )}

            {snapshot?.canonicalState ? (
              <div className="alpha-system-facts alpha-system-facts--three">
                <ContractValue contract={snapshot.canonicalState} field="repository" label={t('app.repository')} compact />
                <ContractValue contract={snapshot.canonicalState} field="branch" label={t('field.branch')} compact />
                <ContractValue contract={snapshot.canonicalState} field="head_sha" label={t('field.head')} compact />
                <ContractValue contract={snapshot.canonicalState} field="observed_at" label={t('field.observedAt')} compact />
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label={t('field.freshness')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noCanonicalState')} />
            )}
          </div>
        </Panel>

        <Panel title={t('system.agents')} eyebrow="AGENTS" className="alpha-system-agents">
          <AgentCards agents={snapshot?.agents} />
          <p className="alpha-panel-note">{t('system.agentSeparationNote')}</p>
        </Panel>

        <Panel title={t('system.connectors')} eyebrow="CONNECTORS" className="alpha-system-connectors">
          <ContractList
            contracts={snapshot?.connectors}
            emptyMessage={t('system.noConnectors')}
            className="alpha-swarm-list"
            render={(connector, index) => (
              <article key={index} className="alpha-swarm-record">
                <div className="alpha-swarm-record-grid alpha-swarm-record-grid--two">
                  <ContractValue contract={connector} field="connector_id" label={t('field.connector')} compact />
                  <ContractValue contract={connector} field="state" label={t('field.state')} compact />
                  <ContractValue contract={connector} field="health" label={t('field.health')} compact />
                  <ContractValue contract={connector} field="auth_state" label={t('field.authState')} compact />
                </div>
              </article>
            )}
          />
        </Panel>

        <Panel title={t('system.locks')} eyebrow="LOCKS" className="alpha-system-locks">
          <ContractList
            contracts={snapshot?.locks}
            emptyMessage={t('system.noLocks')}
            className="alpha-swarm-list"
            render={(lock, index) => (
              <article key={index} className="alpha-swarm-record">
                <div className="alpha-swarm-record-grid alpha-swarm-record-grid--two">
                  <ContractValue contract={lock} field="resource" label={t('field.resource')} compact />
                  <ContractValue contract={lock} field="owner" label={t('field.owner')} compact />
                  <ContractValue contract={lock} field="order_id" label={t('field.orderId')} compact />
                  <ContractValue contract={lock} field="acquired_at" label={t('field.acquiredAt')} compact />
                </div>
              </article>
            )}
          />
        </Panel>

        <div className="alpha-system-topology">
          <LiveSwarmTopology
            leader={snapshot?.leader}
            agents={snapshot?.agents}
            connectors={snapshot?.connectors}
          />
        </div>

        <Panel title={t('system.policies')} eyebrow="POLICIES" className="alpha-system-policies">
          <MissingAuthority message={t('system.noPolicyContract')} />
        </Panel>

        <Panel title={t('system.controlPlane')} eyebrow="CONTROL PLANE" className="alpha-system-control-plane">
          <div className="alpha-swarm-stack">
            {snapshot?.systemState ? (
              <div className="alpha-system-facts alpha-system-facts--two">
                <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} compact />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noSystemStateControlPlane')} />
            )}

            <ContractList
              contracts={snapshot?.gates}
              emptyMessage={t('system.noGates')}
              className="alpha-swarm-list"
              render={(gate, index) => (
                <article key={index} className="alpha-swarm-record">
                  <div className="alpha-swarm-record-grid alpha-swarm-record-grid--three">
                    <ContractValue contract={gate} field="gate_id" label={t('field.gate')} compact />
                    <ContractValue contract={gate} field="allowed" label={t('field.allowed')} compact />
                    <ContractValue contract={gate} field="reason" label={t('field.reason')} compact />
                  </div>
                </article>
              )}
            />
            <p className="alpha-panel-note">{t('system.controlPlaneNote')}</p>
          </div>
        </Panel>

        <Panel title={t('system.health')} eyebrow="SYSTEM HEALTH" className="alpha-system-health">
          <div className="alpha-swarm-stack">
            {snapshot?.runtime ? (
              <div className="alpha-system-facts alpha-system-facts--two">
                <ContractValue contract={snapshot.runtime} field="state" label={t('field.runtimeState')} compact />
                <ContractValue contract={snapshot.runtime} field="observed_at" label={t('field.runtimeObservedAt')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noRuntime')} />
            )}

            {snapshot?.telemetry ? (
              <div className="alpha-system-facts alpha-system-facts--two">
                <ContractValue contract={snapshot.telemetry} field="metrics" label={t('field.telemetryMetrics')} compact />
                <ContractValue contract={snapshot.telemetry} field="observed_at" label={t('field.telemetryObservedAt')} compact />
              </div>
            ) : (
              <MissingAuthority message={t('system.noTelemetry')} />
            )}

            <MissingAuthority message={t('system.noAggregateHealth')} />
          </div>
        </Panel>

        <div className="alpha-system-agent-grid-area">
          <AgentGrid agents={snapshot?.agents} />
        </div>
      </div>
    </div>
  )
}
