import { readContractText } from './contract-read-model'
import type { ViewContract } from './contracts'
import { useI18n } from './i18n'
import { MissingAuthority } from './premium-mission-primitives'
import { visualQaFixtureEnabled } from './visual-qa-mode'

function AmbientScene() {
  return (
    <svg
      className="swarm-scene__ambient"
      viewBox="0 0 1200 620"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="swarm-scene-ambient-svg"
    >
      <defs>
        <linearGradient id="swarm-horizon" x1="0" x2="1">
          <stop offset="0%" stopColor="#16d9ff" stopOpacity="0" />
          <stop offset="34%" stopColor="#16d9ff" stopOpacity="0.42" />
          <stop offset="68%" stopColor="#8c5cff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8c5cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="swarm-city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16395b" stopOpacity="0.66" />
          <stop offset="100%" stopColor="#030814" stopOpacity="0.98" />
        </linearGradient>
      </defs>

      <path d="M0 430 C210 386 360 408 520 374 C690 338 820 384 1200 330" fill="none" stroke="url(#swarm-horizon)" strokeWidth="2" />
      <path d="M0 438 C220 404 370 430 538 392 C735 346 868 408 1200 354" fill="none" stroke="url(#swarm-horizon)" strokeWidth="1" opacity="0.42" />

      <g fill="url(#swarm-city)" opacity="0.8">
        <path d="M0 620V472h42v-72h30v54h48v-104h44v122h38v-64h48v212Z" />
        <path d="M950 620V446h42v-86h40v118h34v-142h54v126h34v-74h46v232Z" />
      </g>

      <g stroke="#5bdcff" strokeOpacity="0.08" strokeWidth="1">
        <path d="M190 620L520 356" /><path d="M340 620L560 356" /><path d="M490 620L590 356" />
        <path d="M710 620L620 356" /><path d="M860 620L660 356" /><path d="M1010 620L700 356" />
        <path d="M138 560H1062" /><path d="M208 516H992" /><path d="M278 474H922" /><path d="M350 434H850" />
      </g>
    </svg>
  )
}

function AgentCard({ contract }: { contract: ViewContract }) {
  const { t } = useI18n()
  const agent = readContractText(contract, 'agent_id', t('common.unknown'))
  const role = readContractText(contract, 'role', t('common.unknown'))
  const runtime = readContractText(contract, 'runtime_state', t('common.unknown'))
  const activity = readContractText(contract, 'activity', t('common.unknown'))

  return (
    <div className="swarm-scene__agent" tabIndex={0} aria-label={`${t('field.agent')}: ${agent}`}>
      <div className="swarm-scene__agent-orb" aria-hidden="true">A</div>
      <div className="swarm-scene__agent-copy">
        <strong>{agent}</strong>
        <span>{role}</span>
        <small>{runtime} · {activity}</small>
      </div>
    </div>
  )
}

function AgentBank({ agents, side }: { agents: readonly ViewContract[]; side: 'left' | 'right' }) {
  return (
    <div className={`swarm-scene__bank swarm-scene__bank--${side}`}>
      {agents.map((agent, index) => (
        <AgentCard key={`${side}-${index}-${readContractText(agent, 'agent_id', String(index))}`} contract={agent} />
      ))}
    </div>
  )
}

function ToolsData({ connectors }: { connectors?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <aside className="swarm-scene__tools" aria-label="Tools and data">
      <div className="swarm-scene__tools-title">TOOLS & DATA</div>
      {!connectors ? (
        <MissingAuthority message={t('system.noConnectors')} compact />
      ) : connectors.length === 0 ? (
        <p className="alpha-empty">0 CONNECTORS</p>
      ) : (
        connectors.slice(0, 5).map((connector, index) => (
          <div className="swarm-scene__tool-row" key={index}>
            <span className="swarm-scene__tool-icon" aria-hidden="true">◈</span>
            <span>{readContractText(connector, 'connector_id', t('common.unknown'))}</span>
            <small>{readContractText(connector, 'state', t('common.unknown'))}</small>
          </div>
        ))
      )}
    </aside>
  )
}

export function LiveSwarmTopology({
  leader,
  agents,
  connectors,
}: {
  leader?: ViewContract
  agents?: readonly ViewContract[]
  connectors?: readonly ViewContract[]
}) {
  const { t } = useI18n()
  const visualQa = visualQaFixtureEnabled()
  const visibleAgents = agents?.slice(0, 6)
  const leftAgents = visibleAgents?.slice(0, 3) ?? []
  const rightAgents = visibleAgents?.slice(3, 6) ?? []
  const leaderId = readContractText(leader, 'agent_id', t('common.unknown'))
  const leaderRole = readContractText(leader, 'role', t('common.unknown'))
  const leaderRuntime = readContractText(leader, 'runtime_state', t('common.unknown'))
  const leaderActivity = readContractText(leader, 'activity', t('common.unknown'))

  return (
    <section aria-label={t('system.liveTopology')} className="swarm-scene" data-visual-qa={visualQa ? 'true' : undefined}>
      <div className="swarm-scene__header">
        <div>
          <p className="swarm-scene__eyebrow">{t('common.phase49ReadOnlyTopology')}</p>
          <h3>{t('system.liveTopology')}</h3>
        </div>
        <div className="swarm-scene__meta">
          <span>{visualQa ? 'VISUAL QA · NOT AUTHORITY' : 'STRICT READ ONLY'}</span>
          <span>{visibleAgents ? `${visibleAgents.length} AGENTS` : t('common.unknown')}</span>
        </div>
      </div>

      <div className="swarm-scene__viewport">
        <AmbientScene />
        <div className="swarm-scene__stars" aria-hidden="true" />
        <div className="swarm-scene__horizon-glow" aria-hidden="true" />

        {visualQa
          ? visibleAgents?.map((_, index) => (
              <span
                key={`qa-beam-${index}`}
                className={`swarm-scene__beam swarm-scene__beam--${index + 1}`}
                data-qa-only="true"
                aria-hidden="true"
              />
            ))
          : null}

        {visibleAgents ? (
          <>
            <AgentBank agents={leftAgents} side="left" />
            <AgentBank agents={rightAgents} side="right" />
          </>
        ) : (
          <div className="swarm-scene__missing-agents">
            <MissingAuthority message={t('system.noAgentsForTopology')} compact />
          </div>
        )}

        <div className="swarm-scene__core-zone">
          {leader ? (
            <>
              <div className="swarm-scene__core" tabIndex={0} aria-label={`${t('field.agent')}: ${leaderId}`}>
                <span className="swarm-scene__core-mark" aria-hidden="true">A</span>
              </div>
              <div className="swarm-scene__core-copy">
                <strong>{leaderId}</strong>
                <span>{leaderRole}</span>
                <small>{leaderRuntime} · {leaderActivity}</small>
              </div>
            </>
          ) : (
            <MissingAuthority message={t('system.noLeaderNode')} compact />
          )}
        </div>

        {visibleAgents?.length === 0 ? (
          <p className="swarm-scene__empty">{t('common.backendRecordsZero')}</p>
        ) : null}

        <div className="swarm-scene__brandline" aria-hidden="true">
          <span>{visibleAgents?.length ?? 0} AGENTS</span>
          <span>1 GOAL</span>
          <span>COORDINATED INTELLIGENCE</span>
        </div>

      </div>

      <ToolsData connectors={connectors} />

      <div className="swarm-scene__footer">
        <span className={`swarm-scene__status-dot ${visualQa ? '' : 'swarm-scene__status-dot--warning'}`} aria-hidden="true" />
        <div>
          {visualQa ? (
            <>
              <strong>VISUAL QA LINKS · NOT AUTHORITY</strong>
              <p>Animated paths are fixture-only presentation data and are never treated as verified runtime relationships.</p>
            </>
          ) : (
            <>
              <strong>{t('system.noWorkerMembership')}</strong>
              <p>{t('system.noActivityEdge')} · {t('system.topologySafety')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
