import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { ContractList, MissingAuthority, Panel, displayValue } from './premium-mission-primitives'

export function LeaderChat({ leader }: { leader?: ViewContract }) {
  const { t } = useI18n()
  const agent = displayValue(readAvailableField<unknown>(leader, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(leader, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(leader, 'runtime_state'), t('common.unknown'))
  const runtimeReason = readUnavailableReason(leader, 'runtime_state')
  const activity = displayValue(readAvailableField<unknown>(leader, 'activity'), t('common.unknown'))
  const activityReason = readUnavailableReason(leader, 'activity')

  return (
    <Panel title={t('mission.leaderInteraction')} className="alphan-leader-chat" eyebrow="LEADER CHAT">
      <div className="alphan-chat-header">
        <div className="alphan-avatar alphan-avatar--leader" aria-hidden="true">A</div>
        <div className="min-w-0">
          <strong>{agent}</strong>
          <span>{role}</span>
        </div>
        <span className="alphan-runtime-chip">{runtime}</span>
      </div>

      <div className="alphan-chat-stream">
        {leader ? (
          <div className="alphan-chat-bubble alphan-chat-bubble--leader">
            <div className="alphan-chat-meta">
              <span>{agent}</span>
              <span>READ ONLY</span>
            </div>
            <p>{t('mission.noInteractionHistory')}</p>
          </div>
        ) : (
          <MissingAuthority message={t('mission.noLeader')} />
        )}

        <div className="alphan-chat-state-grid">
          <div>
            <span>{t('field.runtimeState')}</span>
            <strong>{runtime}</strong>
            {runtimeReason ? <small>{runtimeReason}</small> : null}
          </div>
          <div>
            <span>{t('field.activity')}</span>
            <strong>{activity}</strong>
            {activityReason ? <small>{activityReason}</small> : null}
          </div>
        </div>
      </div>

      <div className="alphan-chat-composer" aria-label="Leader composer unavailable">
        <span>READ ONLY · NO COMMAND COMPOSER</span>
        <span aria-hidden="true">›</span>
      </div>
    </Panel>
  )
}

function TopologyNode({ contract, leader = false }: { contract: ViewContract; leader?: boolean }) {
  const { t } = useI18n()
  const agent = displayValue(readAvailableField<unknown>(contract, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(contract, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(contract, 'runtime_state'), t('common.unknown'))

  return (
    <div
      className={`alphan-topology-node ${leader ? 'alphan-topology-node--leader' : ''}`}
      tabIndex={0}
      aria-label={`${t('field.agent')}: ${agent}`}
    >
      <div className="alphan-node-core" aria-hidden="true">{leader ? 'A' : '◇'}</div>
      <div className="alphan-node-copy">
        <strong>{agent}</strong>
        <span>{role}</span>
        <small>{runtime}</small>
      </div>
    </div>
  )
}

function ToolsData({ connectors }: { connectors?: readonly ViewContract[] }) {
  const { t } = useI18n()
  return (
    <aside className="alphan-tools" aria-label="Tools and data">
      <div className="alphan-tools-heading">TOOLS & DATA</div>
      {!connectors ? (
        <MissingAuthority message={t('system.noConnectors')} compact />
      ) : connectors.length === 0 ? (
        <p className="alphan-empty">{t('common.backendRecordsZero')}</p>
      ) : (
        connectors.slice(0, 5).map((connector, index) => (
          <div className="alphan-tool-row" key={index}>
            <span className="alphan-tool-icon" aria-hidden="true">◈</span>
            <span>{displayValue(readAvailableField<unknown>(connector, 'connector_id'), t('common.unknown'))}</span>
            <small>{displayValue(readAvailableField<unknown>(connector, 'state'), t('common.unknown'))}</small>
          </div>
        ))
      )}
    </aside>
  )
}

export function TopologyHero({
  leader,
  agents,
  connectors,
}: {
  leader?: ViewContract
  agents?: readonly ViewContract[]
  connectors?: readonly ViewContract[]
}) {
  const { t } = useI18n()
  const visibleAgents = agents?.slice(0, 6)

  return (
    <section aria-label={t('system.liveTopology')} className="alphan-topology-hero">
      <div className="alphan-topology-heading">
        <div>
          <p className="alphan-panel-eyebrow">LIVE SWARM TOPOLOGY</p>
          <h3>{t('system.liveTopology')}</h3>
        </div>
        <div className="alphan-topology-meta">
          <span>STRICT READ ONLY</span>
          <span>{visibleAgents ? `${visibleAgents.length} AGENTS` : t('common.unknown')}</span>
        </div>
      </div>

      <div className="alphan-topology-layout">
        <div className="alphan-topology-stage">
          <span className="alphan-orbit alphan-orbit--one" aria-hidden="true" />
          <span className="alphan-orbit alphan-orbit--two" aria-hidden="true" />
          <span className="alphan-orbit alphan-orbit--three" aria-hidden="true" />
          <span className="alphan-orbit-glow" aria-hidden="true" />

          <div className="alphan-topology-center">
            {leader ? <TopologyNode contract={leader} leader /> : <MissingAuthority message={t('system.noLeaderNode')} compact />}
          </div>

          <div className="alphan-topology-satellites">
            {!visibleAgents ? (
              <MissingAuthority message={t('system.noAgentsForTopology')} compact />
            ) : visibleAgents.length === 0 ? (
              <p className="alphan-empty">{t('common.backendRecordsZero')}</p>
            ) : (
              visibleAgents.map((agent, index) => <TopologyNode key={index} contract={agent} />)
            )}
          </div>
        </div>

        <ToolsData connectors={connectors} />
      </div>

      <div className="alphan-topology-footer">
        <span className="alphan-status-dot alphan-status-dot--warning" aria-hidden="true" />
        <div>
          <strong>{t('system.noActivityEdge')}</strong>
          <p>{t('system.topologySafety')}</p>
        </div>
      </div>
    </section>
  )
}
