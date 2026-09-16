import type { ReactNode } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n, type SupportedLocale } from './i18n'
import { useOperationsData } from './operations-data'

const futureChainRegionLabels: Record<SupportedLocale, string> = {
  'de-DE': 'Zukünftige Kette',
  'en-US': 'Future chain',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
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

function ContractValue({ contract, field, label }: { contract?: ViewContract; field: string; label: string }) {
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

function ContractList({ contracts, emptyMessage, render }: { contracts: readonly ViewContract[] | undefined; emptyMessage: string; render: (contract: ViewContract, index: number) => ReactNode }) {
  const { t } = useI18n()
  if (!contracts) return <MissingAuthority message={emptyMessage} />
  if (contracts.length === 0) return <p className="text-sm text-slate-400">{t('common.backendRecordsZero')}</p>
  return <div className="space-y-3">{contracts.map(render)}</div>
}

function nestedContract(contract: ViewContract, field: string): ViewContract | undefined {
  const value = readAvailableField<unknown>(contract, field)
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ViewContract>
  if (typeof candidate.contract !== 'string' || !candidate.fields || typeof candidate.fields !== 'object') return undefined
  return candidate as ViewContract
}

function displayValue(value: unknown, unknownText: string, trueText: string, falseText: string): string {
  if (typeof value === 'boolean') return value ? trueText : falseText
  if (value === null || value === undefined || value === '') return unknownText
  return String(value)
}

function ProvenanceTrace({ finding, index }: { finding: ViewContract; index: number }) {
  const { t } = useI18n()
  const evidence = nestedContract(finding, 'evidence')
  const provenance = nestedContract(finding, 'provenance')
  const observationId = readAvailableField<unknown>(finding, 'observation_id')

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label={t('evidence.provenanceTraceLabel', { index: index + 1 })}>
      <div className="grid gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('evidence.request')}</p>
          <p className="mt-2 font-mono text-sm text-slate-300">{t('common.unavailable')}</p>
          <p className="mt-1 text-xs text-slate-500">NO_EXPLICIT_REQUEST_RELATIONSHIP</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('field.evidence')}</p>
          <p className="mt-2 break-words font-mono text-sm text-slate-300">
            {displayValue(readAvailableField(evidence, 'reference'), t('common.unknown'), t('common.true'), t('common.false'))}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('evidence.backendNestedEvidence')}</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('evidence.finding')}</p>
          <p className="mt-2 break-words font-mono text-sm text-slate-300">
            {displayValue(observationId, t('common.unknown'), t('common.true'), t('common.false'))}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('evidence.explicitObservationBinding')}</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('evidence.plan')}</p>
          <p className="mt-2 font-mono text-sm text-slate-300">{t('common.unavailable')}</p>
          <p className="mt-1 text-xs text-slate-500">NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ContractValue contract={provenance} field="source" label={t('field.source')} />
        <ContractValue contract={provenance} field="target_id" label={t('field.target')} />
        <ContractValue contract={provenance} field="collector_id" label={t('field.collector')} />
        <ContractValue contract={provenance} field="transport_id" label={t('field.transport')} />
      </div>
    </article>
  )
}

export function EvidenceAudit() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t, locale } = useI18n()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('common.phase47ReadOnly')}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{t('evidence.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('evidence.description')}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {t('common.authority')} {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </div>
      </header>

      {!authorityAvailable ? <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">{t('evidence.authorityUnavailable')}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title={t('evidence.explorer')}>
          <ContractList contracts={snapshot?.evidence} emptyMessage={t('evidence.noEvidence')} render={(evidence, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={evidence} field="source" label={t('field.source')} />
                <ContractValue contract={evidence} field="reference" label={t('field.reference')} />
                <ContractValue contract={evidence} field="observed_at" label={t('field.observedAt')} />
                <ContractValue contract={evidence} field="digest" label={t('field.digest')} />
                <ContractValue contract={evidence} field="verification_state" label={t('field.verificationState')} />
              </div>
            </article>
          )} />
        </Section>

        <Section title={t('evidence.verificationRecords')}>
          <ContractList contracts={snapshot?.evidence} emptyMessage={t('evidence.noVerification')} render={(evidence, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={evidence} field="reference" label={t('field.evidenceReference')} />
                <ContractValue contract={evidence} field="verification_state" label={t('field.backendVerificationState')} />
              </div>
            </article>
          )} />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('evidence.verificationNote')}</p>
        </Section>

        <Section title={t('evidence.findings')}>
          <ContractList contracts={snapshot?.findings} emptyMessage={t('evidence.noFindings')} render={(finding, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={finding} field="reader_id" label={t('field.reader')} />
                <ContractValue contract={finding} field="claim" label={t('field.claim')} />
                <ContractValue contract={finding} field="observation_id" label={t('field.observation')} />
                <ContractValue contract={finding} field="classification" label={t('field.classification')} />
              </div>
            </article>
          )} />
        </Section>

        <Section title={t('evidence.provenanceGraph')}>
          <ContractList contracts={snapshot?.findings} emptyMessage={t('evidence.noProvenance')} render={(finding, index) => <ProvenanceTrace key={index} finding={finding} index={index} />} />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('evidence.provenanceNote')}</p>
        </Section>

        <Section title={t('evidence.auditTimeline')}>
          <ContractList contracts={snapshot?.audit} emptyMessage={t('evidence.noAudit')} render={(event, index) => (
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
          )} />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('evidence.auditNote')}</p>
        </Section>

        <Section title={t('evidence.traceInspector')}>
          <ContractList contracts={snapshot?.findings} emptyMessage={t('evidence.noTrace')} render={(finding, index) => {
            const provenance = nestedContract(finding, 'provenance')
            return (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                {provenance ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={provenance} field="observation_id" label={t('field.observation')} />
                    <ContractValue contract={provenance} field="observed_url" label={t('field.observedUrl')} />
                    <ContractValue contract={provenance} field="status" label={t('field.status')} />
                    <ContractValue contract={provenance} field="observed_at" label={t('field.observedAt')} />
                    <ContractValue contract={provenance} field="body_digest" label={t('field.bodyDigest')} />
                    <ContractValue contract={provenance} field="body_size" label={t('field.bodySize')} />
                    <ContractValue contract={provenance} field="freshness_result" label={t('field.freshnessResult')} />
                    <ContractValue contract={provenance} field="freshness_max_age_seconds" label={t('field.freshnessWindow')} />
                    <ContractValue contract={provenance} field="verification_state" label={t('field.verificationState')} />
                  </div>
                ) : <MissingAuthority message={t('evidence.noFindingProvenance')} />}
              </article>
            )
          }} />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('evidence.traceNote')}</p>
        </Section>
      </div>

      <section aria-label={futureChainRegionLabels[locale]} className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">{t('evidence.futureChain')}</h3>
        <p className="mt-3 font-mono text-sm text-slate-400">{t('evidence.futureChainValue')}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{t('evidence.futureChainNote')}</p>
      </section>
    </div>
  )
}
