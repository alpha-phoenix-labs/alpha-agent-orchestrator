import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { MissingAuthority, Panel, displayValue } from './premium-mission-primitives'

const visualQaLeaderConversation = [
  { speaker: 'Du', time: '14:28', kind: 'user' as const, text: 'Analysiere die Marktdaten für erneuerbare Energien und erstelle eine strukturierte Zusammenfassung mit Chancen, Risiken und konkreten Handlungsempfehlungen.' },
  { speaker: 'Alphan · Leader', time: '14:28', kind: 'leader' as const, text: 'Verstanden. Ich übergebe die Aufgabe an das Swarm. Die folgenden Agenten arbeiten parallel an deiner Anfrage.' },
  { speaker: 'Du', time: '14:29', kind: 'user' as const, text: 'Perfekt. Bitte priorisiere regulatorische Entwicklungen und bewerte die Quellenqualität.' },
]

const visualQaLeaderChecklist = [
  'Ziel interpretiert',
  'Plan erstellt',
  'Agenten zugewiesen',
  'Daten werden analysiert',
  'Ausführung gestartet',
]

function visualQaFixtureEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_VISUAL_QA_FIXTURES !== 'true') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('visualQa') === 'premium'
}

const nodePositions = [
  { x: 24, y: 22, tone: 'cyan', glyph: '⌕' },
  { x: 13, y: 50, tone: 'green', glyph: '▤' },
  { x: 28, y: 79, tone: 'cyan', glyph: '▥' },
  { x: 76, y: 22, tone: 'violet', glyph: '◇' },
  { x: 87, y: 50, tone: 'green', glyph: '⌘' },
  { x: 72, y: 79, tone: 'violet', glyph: '▣' },
] as const

const qaEdgePaths = [
  'M500 250 C430 205 390 110 240 110',
  'M500 250 C385 250 300 250 130 250',
  'M500 250 C420 305 380 390 280 395',
  'M500 250 C570 205 610 110 760 110',
  'M500 250 C615 250 700 250 870 250',
  'M500 250 C580 305 620 390 720 395',
] as const

function qaMode(): boolean {
  return visualQaFixtureEnabled()
}

export function LeaderChat({ leader }: { leader?: ViewContract }) {
  const { t } = useI18n()
  const visualQa = qaMode()
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

      <div className={`alphan-chat-stream ${visualQa ? 'alphan-chat-stream--qa' : ''}`}>
        {visualQa ? (
          <div className="alphan-qa-conversation" data-testid="visual-qa-conversation">
            {visualQaLeaderConversation.map((message, index) => (
              <div
                key={`${message.speaker}-${message.time}-${index}`}
                className={`alphan-chat-bubble alphan-chat-bubble--${message.kind}`}
              >
                <div className="alphan-chat-meta">
                  <span>{message.speaker}</span>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
                {message.kind === 'leader' ? (
                  <ul className="alphan-chat-checklist" aria-label="Visual QA task progress">
                    {visualQaLeaderChecklist.map((item) => (
                      <li key={item}><span aria-hidden="true">✓</span>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : leader ? (
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

        {!visualQa ? (
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
        ) : null}
      </div>

      <div className={`alphan-chat-composer ${visualQa ? 'alphan-chat-composer--qa' : ''}`} aria-label="Leader composer unavailable">
        <span>{visualQa ? 'Nachricht an den Leader …' : 'READ ONLY · NO COMMAND COMPOSER'}</span>
        <span className="alphan-composer-send" aria-hidden="true">➤</span>
      </div>
    </Panel>
  )
}

function TopologyNode({
  contract,
  leader = false,
  position,
  tone = 'cyan',
  glyph = '◇',
}: {
  contract: ViewContract
  leader?: boolean
  position?: { x: number; y: number }
  tone?: 'cyan' | 'violet' | 'green'
  glyph?: string
}) {
  const { t } = useI18n()
  const agent = displayValue(readAvailableField<unknown>(contract, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(contract, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(contract, 'runtime_state'), t('common.unknown'))

  return (
    <div
      className={[
        'alphan-topology-node',
        leader ? 'alphan-topology-node--leader' : '',
        `alphan-topology-node--${tone}`,
      ].filter(Boolean).join(' ')}
      style={position ? { left: `${position.x}%`, top: `${position.y}%` } : undefined}
      tabIndex={0}
      aria-label={`${t('field.agent')}: ${agent}`}
    >
      <div className="alphan-node-orbit" aria-hidden="true" />
      <div className="alphan-node-core" aria-hidden="true">{leader ? 'A' : glyph}</div>
      <div className="alphan-node-copy">
        <strong>{agent}</strong>
        <span>{role}</span>
        <small><i aria-hidden="true" />{runtime}</small>
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

function TopologyCanvas({ visualQa }: { visualQa: boolean }) {
  return (
    <svg
      className="alphan-topology-canvas"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="swarm-topology-svg"
    >
      <defs>
        <linearGradient id="alphan-edge-cyan" x1="0" x2="1">
          <stop offset="0%" stopColor="#20e7ff" stopOpacity="0.2" />
          <stop offset="48%" stopColor="#3aa7ff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#b24dff" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="alphan-edge-violet" x1="1" x2="0">
          <stop offset="0%" stopColor="#c04cff" stopOpacity="0.22" />
          <stop offset="48%" stopColor="#8a58ff" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#2aeaff" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id="alphan-core-halo">
          <stop offset="0%" stopColor="#4deaff" stopOpacity="0.48" />
          <stop offset="42%" stopColor="#4878ff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#9f4cff" stopOpacity="0" />
        </radialGradient>
        <filter id="alphan-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className="alphan-svg-orbit alphan-svg-orbit--outer" cx="500" cy="250" rx="390" ry="184" />
      <ellipse className="alphan-svg-orbit alphan-svg-orbit--inner" cx="500" cy="250" rx="285" ry="133" />
      <circle cx="500" cy="250" r="118" fill="url(#alphan-core-halo)" />

      {visualQa ? qaEdgePaths.map((path, index) => (
        <g key={path} data-qa-only="true">
          <path className="alphan-edge-shadow" d={path} filter="url(#alphan-edge-glow)" />
          <path
            className={`alphan-edge-flow alphan-edge-flow--${index % 2 === 0 ? 'cyan' : 'violet'}`}
            d={path}
            stroke={index % 2 === 0 ? 'url(#alphan-edge-cyan)' : 'url(#alphan-edge-violet)'}
          />
        </g>
      )) : null}

      {visualQa ? (
        <g className="alphan-orbit-particles" data-qa-only="true">
          <circle cx="170" cy="182" r="5" />
          <circle cx="330" cy="78" r="4" />
          <circle cx="660" cy="94" r="4" />
          <circle cx="822" cy="314" r="5" />
          <circle cx="495" cy="438" r="4" />
        </g>
      ) : null}
    </svg>
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
  const visualQa = qaMode()
  const visibleAgents = agents?.slice(0, 6)

  return (
    <section aria-label={t('system.liveTopology')} className="alphan-topology-hero" data-visual-qa={visualQa ? 'true' : undefined}>
      <div className="alphan-topology-heading">
        <div>
          <p className="alphan-panel-eyebrow">LIVE SWARM TOPOLOGY</p>
          <h3>{t('system.liveTopology')}</h3>
        </div>
        <div className="alphan-topology-meta">
          <span>{visualQa ? 'VISUAL QA' : 'STRICT READ ONLY'}</span>
          <span>{visibleAgents ? `${visibleAgents.length} AGENTS` : t('common.unknown')}</span>
        </div>
      </div>

      <div className="alphan-topology-layout">
        <div className="alphan-topology-stage">
          <TopologyCanvas visualQa={visualQa} />
          <div className="alphan-topology-center">
            {leader ? <TopologyNode contract={leader} leader tone="cyan" /> : <MissingAuthority message={t('system.noLeaderNode')} compact />}
          </div>

          {visibleAgents ? visibleAgents.map((agent, index) => {
            const position = nodePositions[index]
            return position ? (
              <TopologyNode
                key={index}
                contract={agent}
                position={{ x: position.x, y: position.y }}
                tone={position.tone}
                glyph={position.glyph}
              />
            ) : null
          }) : (
            <div className="alphan-topology-satellites">
              <MissingAuthority message={t('system.noAgentsForTopology')} compact />
            </div>
          )}

          {visibleAgents?.length === 0 ? <p className="alphan-empty alphan-topology-empty">{t('common.backendRecordsZero')}</p> : null}

          <div className="alphan-topology-brand-copy" aria-hidden="true">
            <span>{visibleAgents?.length ?? 0} AGENTS</span>
            <span>1 GOAL</span>
            <span>COORDINATED INTELLIGENCE</span>
          </div>
        </div>

        <ToolsData connectors={connectors} />
      </div>

      <div className={`alphan-topology-footer ${visualQa ? 'alphan-topology-footer--qa' : ''}`}>
        <span className={`alphan-status-dot ${visualQa ? '' : 'alphan-status-dot--warning'}`} aria-hidden="true" />
        <div>
          <strong>{visualQa ? 'VISUAL QA LINKS · NOT AUTHORITY' : t('system.noActivityEdge')}</strong>
          <p>{visualQa ? 'Animated paths are fixture-only presentation data and are never treated as verified runtime relationships.' : t('system.topologySafety')}</p>
        </div>
      </div>
    </section>
  )
}
