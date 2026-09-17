import { readAvailableField, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { MissingAuthority, displayValue } from './premium-mission-primitives'
import { visualQaFixtureEnabled } from './visual-qa-mode'

const nodePositions = [
  { x: 23, y: 24, tone: 'cyan', glyph: '⌕' },
  { x: 14, y: 52, tone: 'emerald', glyph: '▤' },
  { x: 28, y: 79, tone: 'cyan', glyph: '▥' },
  { x: 77, y: 24, tone: 'violet', glyph: '◇' },
  { x: 86, y: 52, tone: 'emerald', glyph: '⌘' },
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
  tone?: 'cyan' | 'violet' | 'emerald'
  glyph?: string
}) {
  const { t } = useI18n()
  const agent = displayValue(readAvailableField<unknown>(contract, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(contract, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(contract, 'runtime_state'), t('common.unknown'))
  const activity = displayValue(readAvailableField<unknown>(contract, 'activity'), t('common.unknown'))

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
        <small><i aria-hidden="true" />{runtime} · {activity}</small>
      </div>
    </div>
  )
}

function SVGConnections({ visualQa }: { visualQa: boolean }) {
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
          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.12" />
          <stop offset="48%" stopColor="#3b82f6" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="alphan-edge-violet" x1="1" x2="0">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.18" />
          <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.78" />
        </linearGradient>
        <radialGradient id="alphan-core-halo">
          <stop offset="0%" stopColor="#86f7ff" stopOpacity="0.52" />
          <stop offset="38%" stopColor="#2563eb" stopOpacity="0.22" />
          <stop offset="72%" stopColor="#a855f7" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <filter id="alphan-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className="alphan-svg-orbit alphan-svg-orbit--outer" cx="500" cy="250" rx="392" ry="184" />
      <ellipse className="alphan-svg-orbit alphan-svg-orbit--inner" cx="500" cy="250" rx="286" ry="132" />
      <circle cx="500" cy="250" r="136" fill="url(#alphan-core-halo)" />

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

function ToolsData({ connectors }: { connectors?: readonly ViewContract[] }) {
  const { t } = useI18n()

  return (
    <aside className="alphan-tools" aria-label="Tools and data">
      <div className="alphan-tools-heading">TOOLS & DATA</div>
      {!connectors ? (
        <MissingAuthority message={t('system.noConnectors')} compact />
      ) : connectors.length === 0 ? (
        <p className="alphan-empty">0 CONNECTORS</p>
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

  return (
    <section aria-label={t('system.liveTopology')} className="alphan-topology-hero" data-visual-qa={visualQa ? 'true' : undefined}>
      <div className="alphan-topology-heading">
        <div>
          <p className="alphan-panel-eyebrow">{t('common.phase49ReadOnlyTopology')}</p>
          <h3>{t('system.liveTopology')}</h3>
        </div>
        <div className="alphan-topology-meta">
          <span>{visualQa ? 'VISUAL QA · NOT AUTHORITY' : 'STRICT READ ONLY'}</span>
          <span>{visibleAgents ? `${visibleAgents.length} AGENTS` : t('common.unknown')}</span>
        </div>
      </div>

      <div className="alphan-topology-layout">
        <div className="alphan-topology-stage">
          <SVGConnections visualQa={visualQa} />

          <div className="alphan-topology-center">
            {leader ? (
              <TopologyNode contract={leader} leader tone="cyan" />
            ) : (
              <MissingAuthority message={t('system.noLeaderNode')} compact />
            )}
          </div>

          {visibleAgents ? visibleAgents.map((agent, index) => {
            const position = nodePositions[index]
            return position ? (
              <TopologyNode
                key={`${index}-${displayValue(readAvailableField<unknown>(agent, 'agent_id'), String(index))}`}
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

          {visibleAgents?.length === 0 ? (
            <p className="alphan-empty alphan-topology-empty">{t('common.backendRecordsZero')}</p>
          ) : null}

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
