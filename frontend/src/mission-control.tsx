import type { ReactNode } from 'react'

import { ShellErrorBoundary } from './app-shell'
import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { useOperationsData } from './operations-data'

function ContractValue({
  contract,
  field,
  label,
}: {
  contract?: ViewContract
  field: string
  label: string
}) {
  const { t } = useI18n()
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)
  const formattedValue =
    typeof value === 'boolean'
      ? value
        ? t('common.true')
        : t('common.false')
      : value === null || value === undefined || value === ''
        ? t('common.unknown')
        : String(value)

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <span className="break-words font-mono text-sm text-slate-100">{formattedValue}</span>
      {reason ? <span className="text-xs text-slate-500">{reason}</span> : null}
    </div>
  )
}

function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  return (
    <section
      aria-label={title}
      className={`rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl ${className}`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">{title}</h3>
      <div className="mt-4">
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

function MissingAuthority({ message }: { message: string }) {
  const { t } = useI18n()
  return (
    <div className="rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-sm text-amber-50/80">
      <strong className="font-semibold text-amber-100">{t('common.unavailable')}</strong>
      <p className="mt-1 text-xs leading-5 text-amber-50/60">{message}</p>
    </div>
  )
}

function ContractList({
  contracts,
  emptyMessage,
  render,
}: {
  contracts: readonly ViewContract[] | undefined
  emptyMessage: string
  render: (contract: ViewContract, index: number) => ReactNode
}) {
  const { t } = useI18n()
  if (!contracts) {
    return <MissingAuthority message={emptyMessage} />
  }

  if (contracts.length === 0) {
    return <p className="text-sm text-slate-400">{t('common.backendRecordsZero')}</p>
  }

  return <div className="space-y-3">{contracts.map(render)}</div>
}

export function MissionControl() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()
  const evidenceCount = snapshot?.evidence?.length
  const findingCount = snapshot?.findings?.length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('common.phase45ReadOnly')}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{t('mission.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('mission.description')}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {t('common.authority')} {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          {t('mission.authorityUnavailable')}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
        <div className="space-y-4">
          <Panel title={t('mission.leaderInteraction')}>
            {snapshot?.leader ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.leader} field="agent_id" label={t('field.agent')} />
                <ContractValue contract={snapshot.leader} field="role" label={t('field.role')} />
                <ContractValue contract={snapshot.leader} field="runtime_state" label={t('field.runtimeState')} />
                <ContractValue contract={snapshot.leader} field="activity" label={t('field.activity')} />
                <div className="sm:col-span-2">
                  <MissingAuthority message={t('mission.noInteractionHistory')} />
                </div>
              </div>
            ) : (
              <MissingAuthority message={t('mission.noLeader')} />
            )}
          </Panel>

          <Panel title={t('mission.activeWorkOrder')}>
            {snapshot?.activeWorkOrder ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={snapshot.activeWorkOrder} field="order_id" label={t('field.orderId')} />
                <ContractValue contract={snapshot.activeWorkOrder} field="status" label={t('field.status')} />
                <ContractValue contract={snapshot.activeWorkOrder} field="risk" label={t('field.risk')} />
                <ContractValue contract={snapshot.activeWorkOrder} field="action" label={t('field.action')} />
                <ContractValue contract={snapshot.activeWorkOrder} field="target" label={t('field.target')} />
                <ContractValue contract={snapshot.activeWorkOrder} field="base_state_version" label={t('field.baseState')} />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noActiveWorkOrder')} />
            )}
          </Panel>

          <Panel title={t('mission.lifecycle')}>
            {snapshot?.lifecycle ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.lifecycle} field="order_status" label={t('field.orderStatus')} />
                <ContractValue contract={snapshot.lifecycle} field="stage" label={t('field.lifecycleStage')} />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noLifecycle')} />
            )}
          </Panel>

          <Panel title={t('mission.currentFindings')}>
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">
              {t('common.backendRecordsCount', { count: findingCount ?? t('common.unknown') })}
            </div>
            <ContractList
              contracts={snapshot?.findings}
              emptyMessage={t('mission.noFindings')}
              render={(finding, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ContractValue contract={finding} field="claim" label={t('field.claim')} />
                    <ContractValue contract={finding} field="reader_id" label={t('field.reader')} />
                    <ContractValue contract={finding} field="observation_id" label={t('field.observation')} />
                    <ContractValue contract={finding} field="classification" label={t('field.classification')} />
                  </div>
                </article>
              )}
            />
          </Panel>

          <Panel title={t('mission.evidenceSummary')}>
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">
              {t('common.backendReferencesCount', { count: evidenceCount ?? t('common.unknown') })}
            </div>
            <ContractList
              contracts={snapshot?.evidence}
              emptyMessage={t('mission.noEvidence')}
              render={(evidence, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={evidence} field="source" label={t('field.source')} />
                    <ContractValue contract={evidence} field="reference" label={t('field.reference')} />
                    <ContractValue contract={evidence} field="verification_state" label={t('field.verificationState')} />
                  </div>
                </article>
              )}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">{t('mission.evidenceNote')}</p>
          </Panel>
        </div>

        <aside aria-label={t('mission.rail')} className="space-y-4">
          <Panel title={t('mission.canonicalState')}>
            {snapshot?.canonicalState ? (
              <div className="space-y-3">
                <ContractValue contract={snapshot.canonicalState} field="repository" label={t('app.repository')} />
                <ContractValue contract={snapshot.canonicalState} field="branch" label={t('field.branch')} />
                <ContractValue contract={snapshot.canonicalState} field="head_sha" label={t('field.head')} />
                <ContractValue contract={snapshot.canonicalState} field="observed_at" label={t('field.observedAt')} />
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label={t('field.freshness')} />
              </div>
            ) : (
              <MissingAuthority message={t('mission.canonicalUnavailable')} />
            )}
          </Panel>

          <Panel title={t('mission.gates')}>
            <ContractList
              contracts={snapshot?.gates}
              emptyMessage={t('mission.noGates')}
              render={(gate, index) => (
                <article key={index} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <ContractValue contract={gate} field="gate_id" label={t('field.gate')} />
                  <ContractValue contract={gate} field="allowed" label={t('field.allowed')} />
                  <ContractValue contract={gate} field="reason" label={t('field.reason')} />
                </article>
              )}
            />
          </Panel>

          <Panel title={t('mission.locks')}>
            <ContractList
              contracts={snapshot?.locks}
              emptyMessage={t('mission.noLocks')}
              render={(lock, index) => (
                <article key={index} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <ContractValue contract={lock} field="resource" label={t('field.resource')} />
                  <ContractValue contract={lock} field="owner" label={t('field.owner')} />
                  <ContractValue contract={lock} field="order_id" label={t('field.orderId')} />
                </article>
              )}
            />
          </Panel>

          <Panel title={t('mission.writerStatus')}>
            {snapshot?.writer ? (
              <div className="space-y-3">
                <ContractValue contract={snapshot.writer} field="writer_id" label={t('field.writer')} />
                <ContractValue contract={snapshot.writer} field="proposal_only" label={t('field.proposalOnly')} />
                <ContractValue contract={snapshot.writer} field="runtime_state" label={t('field.runtimeState')} />
              </div>
            ) : (
              <MissingAuthority message={t('mission.noWriter')} />
            )}
          </Panel>

          <Panel title={t('mission.blockers')}>
            <MissingAuthority message={t('mission.noBlockers')} />
          </Panel>
        </aside>
      </div>
    </div>
  )
}
