import type { ReactNode } from 'react'

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
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="break-words font-mono text-sm text-slate-100">{formattedValue}</span>
      {reason ? <span className="text-xs text-slate-500">{reason}</span> : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl"
    >
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">{title}</h3>
      <div className="mt-4">{children}</div>
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

export function WorkOrders() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('common.phase46ReadOnly')}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{t('work.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('work.description')}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {t('common.authority')} {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          {t('work.authorityUnavailable')}
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">{t('work.relationshipNote')}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title={t('work.overview')}>
          <ContractList
            contracts={snapshot?.workOrders}
            emptyMessage={t('work.noOrders')}
            render={(order, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={order} field="order_id" label={t('field.orderId')} />
                  <ContractValue contract={order} field="status" label={t('field.status')} />
                  <ContractValue contract={order} field="risk" label={t('field.risk')} />
                  <ContractValue contract={order} field="action" label={t('field.action')} />
                  <ContractValue contract={order} field="target" label={t('field.target')} />
                  <ContractValue contract={order} field="base_state_version" label={t('field.baseState')} />
                  <ContractValue contract={order} field="expected_effect" label={t('field.expectedEffect')} />
                  <ContractValue contract={order} field="evidence_verified" label={t('field.evidenceVerified')} />
                  <ContractValue contract={order} field="independent_review_confirmed" label={t('field.independentReview')} />
                  <ContractValue contract={order} field="plan_hash" label={t('field.planHash')} />
                  <ContractValue contract={order} field="created_at" label={t('field.createdAt')} />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title={t('work.lifecycle')}>
          {snapshot?.lifecycle ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ContractValue contract={snapshot.lifecycle} field="order_status" label={t('field.orderStatus')} />
              <ContractValue contract={snapshot.lifecycle} field="stage" label={t('field.lifecycleStage')} />
            </div>
          ) : (
            <MissingAuthority message={t('work.noLifecycle')} />
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('work.lifecycleNote')}</p>
        </Section>

        <Section title={t('work.evidence')}>
          <ContractList
            contracts={snapshot?.evidence}
            emptyMessage={t('work.noEvidence')}
            render={(evidence, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={evidence} field="source" label={t('field.source')} />
                  <ContractValue contract={evidence} field="reference" label={t('field.reference')} />
                  <ContractValue contract={evidence} field="observed_at" label={t('field.observedAt')} />
                  <ContractValue contract={evidence} field="digest" label={t('field.digest')} />
                  <ContractValue contract={evidence} field="verification_state" label={t('field.verificationState')} />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title={t('work.findings')}>
          <ContractList
            contracts={snapshot?.findings}
            emptyMessage={t('work.noFindings')}
            render={(finding, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={finding} field="reader_id" label={t('field.reader')} />
                  <ContractValue contract={finding} field="claim" label={t('field.claim')} />
                  <ContractValue contract={finding} field="observation_id" label={t('field.observation')} />
                  <ContractValue contract={finding} field="classification" label={t('field.classification')} />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title={t('work.plan')}>
          {snapshot?.plan ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ContractValue contract={snapshot.plan} field="order_id" label={t('field.orderId')} />
              <ContractValue contract={snapshot.plan} field="action" label={t('field.action')} />
              <ContractValue contract={snapshot.plan} field="target" label={t('field.target')} />
              <ContractValue contract={snapshot.plan} field="expected_effect" label={t('field.expectedEffect')} />
              <ContractValue contract={snapshot.plan} field="risk" label={t('field.risk')} />
              <ContractValue contract={snapshot.plan} field="base_state_version" label={t('field.baseState')} />
              <ContractValue contract={snapshot.plan} field="plan_hash" label={t('field.planHash')} />
              <ContractValue contract={snapshot.plan} field="proposed_writer" label={t('field.proposedWriter')} />
              <ContractValue contract={snapshot.plan} field="created_at" label={t('field.createdAt')} />
              <ContractValue contract={snapshot.plan} field="simulation_only" label={t('field.simulationOnly')} />
            </div>
          ) : (
            <MissingAuthority message={t('work.noPlan')} />
          )}
        </Section>

        <Section title={t('work.audit')}>
          <ContractList
            contracts={snapshot?.audit}
            emptyMessage={t('work.noAudit')}
            render={(event, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={event} field="seq" label={t('field.sequence')} />
                  <ContractValue contract={event} field="event_type" label={t('field.eventType')} />
                  <ContractValue contract={event} field="created_at" label={t('field.createdAt')} />
                  <ContractValue contract={event} field="prev_hash" label={t('field.previousHash')} />
                  <ContractValue contract={event} field="event_hash" label={t('field.eventHash')} />
                  <ContractValue contract={event} field="payload" label={t('field.payload')} />
                </div>
              </article>
            )}
          />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('work.auditNote')}</p>
        </Section>
      </div>
    </div>
  )
}
