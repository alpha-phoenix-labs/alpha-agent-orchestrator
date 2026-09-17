import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { MissingAuthority, Panel, displayValue } from './premium-mission-primitives'
import { visualQaFixtureEnabled } from './visual-qa-mode'

const visualQaLeaderConversation = [
  {
    speaker: 'Du',
    time: '14:28',
    kind: 'user' as const,
    text: 'Analysiere die Marktdaten für erneuerbare Energien und erstelle eine strukturierte Zusammenfassung mit Chancen, Risiken und konkreten Handlungsempfehlungen.',
  },
  {
    speaker: 'Alpha · Leader',
    time: '14:28',
    kind: 'leader' as const,
    text: 'Verstanden. Ich übergebe die Aufgabe an das Swarm. Die folgenden Agenten arbeiten parallel an deiner Anfrage.',
  },
  {
    speaker: 'Du',
    time: '14:29',
    kind: 'user' as const,
    text: 'Perfekt. Bitte priorisiere regulatorische Entwicklungen und bewerte die Quellenqualität.',
  },
]

const visualQaLeaderChecklist = [
  'Ziel interpretiert',
  'Plan erstellt',
  'Agenten zugewiesen',
  'Daten werden analysiert',
  'Ausführung gestartet',
]

export function LeaderChat({ leader }: { leader?: ViewContract }) {
  const { t } = useI18n()
  const visualQa = visualQaFixtureEnabled()
  const agent = displayValue(readAvailableField<unknown>(leader, 'agent_id'), t('common.unknown'))
  const role = displayValue(readAvailableField<unknown>(leader, 'role'), t('common.unknown'))
  const runtime = displayValue(readAvailableField<unknown>(leader, 'runtime_state'), t('common.unknown'))
  const runtimeReason = readUnavailableReason(leader, 'runtime_state')
  const activity = displayValue(readAvailableField<unknown>(leader, 'activity'), t('common.unknown'))
  const activityReason = readUnavailableReason(leader, 'activity')

  return (
    <Panel title={t('mission.leaderInteraction')} className="alpha-leader-chat" eyebrow="LEADER CHAT">
      <div className="alpha-chat-header">
        <div className="alpha-avatar alpha-avatar--leader" aria-hidden="true">A</div>
        <div className="min-w-0">
          <strong>{agent}</strong>
          <span>{role}</span>
        </div>
        <span className="alpha-runtime-chip">{runtime}</span>
      </div>

      <div className={`alpha-chat-stream ${visualQa ? 'alpha-chat-stream--qa' : ''}`}>
        {visualQa ? (
          <div className="alpha-qa-conversation" data-testid="visual-qa-conversation">
            {visualQaLeaderConversation.map((message, index) => (
              <div
                key={`${message.speaker}-${message.time}-${index}`}
                className={`alpha-chat-bubble alpha-chat-bubble--${message.kind}`}
              >
                <div className="alpha-chat-meta">
                  <span>{message.speaker}</span>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
                {message.kind === 'leader' ? (
                  <ul className="alpha-chat-checklist" aria-label="Visual QA task progress">
                    {visualQaLeaderChecklist.map((item) => (
                      <li key={item}><span aria-hidden="true">✓</span>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : leader ? (
          <div className="alpha-chat-bubble alpha-chat-bubble--leader">
            <div className="alpha-chat-meta">
              <span>{agent}</span>
              <span>READ ONLY</span>
            </div>
            <p>{t('mission.noInteractionHistory')}</p>
          </div>
        ) : (
          <MissingAuthority message={t('mission.noLeader')} />
        )}

        {!visualQa ? (
          <div className="alpha-chat-state-grid">
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

      <div className={`alpha-chat-composer ${visualQa ? 'alpha-chat-composer--qa' : ''}`} aria-label="Leader composer unavailable">
        <span>{visualQa ? 'Nachricht an den Leader …' : 'READ ONLY · NO COMMAND COMPOSER'}</span>
        <span className="alpha-composer-send" aria-hidden="true">➤</span>
      </div>
    </Panel>
  )
}
