import type { ReactNode } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import { useOperationsData } from './operations-data'

function nestedContract(contract: ViewContract, field: string): ViewContract | undefined {
  const value = readAvailableField<unknown>(contract, field)
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ViewContract>
  if (typeof candidate.contract !== 'string' || !candidate.fields || typeof candidate.fields !== 'object') return undefined
  return candidate as ViewContract
}

function Stage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Missing({ reason }: { reason: string }) {
  const { t } = useI18n()
  return (
    <div>
      <p className="font-mono text-sm text-slate-300">{t('common.unavailable')}</p>
      <p className="mt-1 text-xs text-slate-500">{reason}</p>
    </div>
  )
}

function Field({ contract, field, label }: { contract?: ViewContract; field: string; label: string }) {
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
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className="mt-1 break-words font-mono text-xs text-slate-300">{formattedValue}</p>
      {reason ? <p className="mt-1 text-[11px] text-slate-600">{reason}</p> : null}
    </div>
  )
}

export function TraceWaterfall() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()
  const findings = snapshot?.findings

  return (
    <section aria-label={t('trace.title')} className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('common.phase410ReadOnlyObservability')}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">{t('trace.title')}</h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">{t('trace.description')}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {t('common.authority')} {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Stage title={t('trace.route')}>
          <Missing reason="NO_ROUTE_STAGE_CONTRACT" />
          <p className="mt-2 text-xs leading-5 text-slate-600">{t('trace.routeNote')}</p>
        </Stage>

        <Stage title={t('trace.read')}>
          {!findings ? (
            <Missing reason="NO_FINDING_PROVENANCE_FOR_READ_TRACE" />
          ) : findings.length === 0 ? (
            <p className="text-sm text-slate-400">{t('trace.readRecordsZero')}</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, index) => {
                const provenance = nestedContract(finding, 'provenance')
                return (
                  <article key={index} aria-label={t('trace.readLabel', { index: index + 1 })} className="grid gap-3 rounded-md border border-white/10 p-3 sm:grid-cols-2">
                    <Field contract={provenance} field="observation_id" label={t('field.observation')} />
                    <Field contract={provenance} field="observed_at" label={t('field.observedAt')} />
                    <Field contract={provenance} field="source" label={t('field.source')} />
                    <Field contract={provenance} field="target_id" label={t('field.target')} />
                    <Field contract={provenance} field="status" label={t('field.readStatus')} />
                    <Field contract={provenance} field="transport_id" label={t('field.transport')} />
                  </article>
                )
              })}
            </div>
          )}
        </Stage>

        <Stage title={t('trace.verify')}>
          {!findings ? (
            <Missing reason="NO_FINDING_EVIDENCE_FOR_VERIFY_TRACE" />
          ) : findings.length === 0 ? (
            <p className="text-sm text-slate-400">{t('trace.verifyRecordsZero')}</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, index) => {
                const evidence = nestedContract(finding, 'evidence')
                return (
                  <article key={index} aria-label={t('trace.verifyLabel', { index: index + 1 })} className="grid gap-3 rounded-md border border-white/10 p-3 sm:grid-cols-2">
                    <Field contract={evidence} field="reference" label={t('field.evidence')} />
                    <Field contract={evidence} field="verification_state" label={t('field.verificationState')} />
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{t('field.verificationTime')}</p>
                      <p className="mt-1 font-mono text-xs text-slate-300">{t('common.unknown')}</p>
                      <p className="mt-1 text-[11px] text-slate-600">NO_VERIFICATION_TIMESTAMP_CONTRACT</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Stage>

        <Stage title={t('trace.plan')}>
          {snapshot?.plan ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field contract={snapshot.plan} field="order_id" label={t('field.order')} />
              <Field contract={snapshot.plan} field="created_at" label={t('field.createdAt')} />
              <Field contract={snapshot.plan} field="proposed_writer" label={t('field.proposedWriter')} />
              <Field contract={snapshot.plan} field="simulation_only" label={t('field.simulationOnly')} />
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-600">{t('trace.noFindingPlanRelationship')}</p>
              </div>
            </div>
          ) : <Missing reason="NO_PLAN_TRACE_CONTRACT_AVAILABLE" />}
        </Stage>

        <Stage title={t('trace.humanGate')}>
          <Missing reason="NO_PHASE4_APPROVAL_TRACE_CONTRACT" />
          <p className="mt-2 text-xs leading-5 text-slate-600">{t('trace.humanGateNote')}</p>
        </Stage>

        <Stage title={t('trace.execution')}>
          <Missing reason="PHASE4_EXECUTION_NOT_AVAILABLE" />
        </Stage>

        <Stage title={t('trace.postVerify')}>
          <Missing reason="PHASE4_POST_VERIFY_NOT_AVAILABLE" />
        </Stage>
      </div>

      <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-xs leading-5 text-amber-50/70">
        {t('trace.boundaryNote')}
      </div>
    </section>
  )
}
