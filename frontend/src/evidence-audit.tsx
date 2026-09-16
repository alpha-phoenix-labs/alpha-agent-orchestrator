import type { ReactNode } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useOperationsData } from './operations-data'

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined || value === '') return 'UNKNOWN'
  return String(value)
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
  return (
    <div className="rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-sm text-amber-50/80">
      <strong className="font-semibold text-amber-100">UNAVAILABLE</strong>
      <p className="mt-1 text-xs leading-5 text-amber-50/60">{message}</p>
    </div>
  )
}

function ContractValue({ contract, field, label }: { contract?: ViewContract; field: string; label: string }) {
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="break-words font-mono text-sm text-slate-100">{formatValue(value)}</span>
      {reason ? <span className="text-xs text-slate-500">{reason}</span> : null}
    </div>
  )
}

function ContractList({ contracts, emptyMessage, render }: { contracts: readonly ViewContract[] | undefined; emptyMessage: string; render: (contract: ViewContract, index: number) => ReactNode }) {
  if (!contracts) return <MissingAuthority message={emptyMessage} />
  if (contracts.length === 0) return <p className="text-sm text-slate-400">0 backend-reported records.</p>
  return <div className="space-y-3">{contracts.map(render)}</div>
}

function nestedContract(contract: ViewContract, field: string): ViewContract | undefined {
  const value = readAvailableField<unknown>(contract, field)
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ViewContract>
  if (typeof candidate.contract !== 'string' || !candidate.fields || typeof candidate.fields !== 'object') return undefined
  return candidate as ViewContract
}

function ProvenanceTrace({ finding, index }: { finding: ViewContract; index: number }) {
  const evidence = nestedContract(finding, 'evidence')
  const provenance = nestedContract(finding, 'provenance')
  const observationId = readAvailableField<unknown>(finding, 'observation_id')

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-3" aria-label={`Provenance trace ${index + 1}`}>
      <div className="grid gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Request</p>
          <p className="mt-2 font-mono text-sm text-slate-300">UNAVAILABLE</p>
          <p className="mt-1 text-xs text-slate-500">NO_EXPLICIT_REQUEST_RELATIONSHIP</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Evidence</p>
          <p className="mt-2 break-words font-mono text-sm text-slate-300">{formatValue(readAvailableField(evidence, 'reference'))}</p>
          <p className="mt-1 text-xs text-slate-500">Backend-nested Evidence contract</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Finding</p>
          <p className="mt-2 break-words font-mono text-sm text-slate-300">{formatValue(observationId)}</p>
          <p className="mt-1 text-xs text-slate-500">Explicit observation binding</p>
        </div>
        <div className="rounded-md border border-white/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Plan</p>
          <p className="mt-2 font-mono text-sm text-slate-300">UNAVAILABLE</p>
          <p className="mt-1 text-xs text-slate-500">NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ContractValue contract={provenance} field="source" label="Source" />
        <ContractValue contract={provenance} field="target_id" label="Target" />
        <ContractValue contract={provenance} field="collector_id" label="Collector" />
        <ContractValue contract={provenance} field="transport_id" label="Transport" />
      </div>
    </article>
  )
}

export function EvidenceAudit() {
  const { snapshot, authorityAvailable } = useOperationsData()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Phase 4.7 · Read-only</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Evidence &amp; Audit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Backend-owned Evidence, Findings, provenance and Audit identities are displayed without local verification, classification, relationship inference or hash-chain validation.</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Authority {authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}</div>
      </header>

      {!authorityAvailable ? <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">Authoritative Evidence &amp; Audit snapshot unavailable. No chain-of-custody state is synthesized.</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Evidence Explorer">
          <ContractList contracts={snapshot?.evidence} emptyMessage="No authoritative Evidence collection is present." render={(evidence, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={evidence} field="source" label="Source" />
                <ContractValue contract={evidence} field="reference" label="Reference" />
                <ContractValue contract={evidence} field="observed_at" label="Observed at" />
                <ContractValue contract={evidence} field="digest" label="Digest" />
                <ContractValue contract={evidence} field="verification_state" label="Verification state" />
              </div>
            </article>
          )} />
        </Section>

        <Section title="Verification Records">
          <ContractList contracts={snapshot?.evidence} emptyMessage="No backend Evidence verification records are present." render={(evidence, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={evidence} field="reference" label="Evidence reference" />
                <ContractValue contract={evidence} field="verification_state" label="Backend verification state" />
              </div>
            </article>
          )} />
          <p className="mt-3 text-xs leading-5 text-slate-500">Verification state is displayed exactly as supplied by the backend; this view performs no verification.</p>
        </Section>

        <Section title="Findings">
          <ContractList contracts={snapshot?.findings} emptyMessage="No authoritative Finding collection is present." render={(finding, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={finding} field="reader_id" label="Reader" />
                <ContractValue contract={finding} field="claim" label="Claim" />
                <ContractValue contract={finding} field="observation_id" label="Observation" />
                <ContractValue contract={finding} field="classification" label="Classification" />
              </div>
            </article>
          )} />
        </Section>

        <Section title="Provenance / Trace Graph">
          <ContractList contracts={snapshot?.findings} emptyMessage="No Finding-owned provenance is present; graph relationships remain unavailable." render={(finding, index) => <ProvenanceTrace key={index} finding={finding} index={index} />} />
          <p className="mt-3 text-xs leading-5 text-slate-500">Only relationships explicitly nested in the backend Finding contract are shown. Missing Request-to-Evidence and Finding-to-Plan edges remain UNAVAILABLE.</p>
        </Section>

        <Section title="Audit Timeline">
          <ContractList contracts={snapshot?.audit} emptyMessage="No authoritative Audit collection is present." render={(event, index) => (
            <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={event} field="seq" label="Sequence" />
                <ContractValue contract={event} field="event_type" label="Event type" />
                <ContractValue contract={event} field="created_at" label="Created at" />
                <ContractValue contract={event} field="prev_hash" label="Previous hash" />
                <ContractValue contract={event} field="event_hash" label="Event hash" />
                <ContractValue contract={event} field="payload" label="Payload" />
              </div>
            </article>
          )} />
          <p className="mt-3 text-xs leading-5 text-slate-500">Events remain in backend-supplied order. Hash fields are identities only; the frontend does not verify the Audit chain. Raw payload stays unavailable when marked UI-unsafe.</p>
        </Section>

        <Section title="Trace Inspector">
          <ContractList contracts={snapshot?.findings} emptyMessage="No backend provenance is available for trace inspection." render={(finding, index) => {
            const provenance = nestedContract(finding, 'provenance')
            return (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                {provenance ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={provenance} field="observation_id" label="Observation" />
                    <ContractValue contract={provenance} field="observed_url" label="Observed URL" />
                    <ContractValue contract={provenance} field="status" label="Status" />
                    <ContractValue contract={provenance} field="observed_at" label="Observed at" />
                    <ContractValue contract={provenance} field="body_digest" label="Body digest" />
                    <ContractValue contract={provenance} field="body_size" label="Body size" />
                    <ContractValue contract={provenance} field="freshness_result" label="Freshness result" />
                    <ContractValue contract={provenance} field="freshness_max_age_seconds" label="Freshness window" />
                    <ContractValue contract={provenance} field="verification_state" label="Verification state" />
                  </div>
                ) : <MissingAuthority message="Finding has no available backend PROVENANCE contract." />}
              </article>
            )
          }} />
          <p className="mt-3 text-xs leading-5 text-slate-500">No standalone TRACE contract exists. This inspector exposes backend provenance only and does not reinterpret Activity, Telemetry or Audit as trace authority.</p>
        </Section>
      </div>

      <section aria-label="Future chain" className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">Future Chain · Non-operative</h3>
        <p className="mt-3 font-mono text-sm text-slate-400">APPROVAL → CAPABILITY → EXECUTION → POST_VERIFY</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Structural roadmap context only. No controls, capability issuance, execution or post-verify action exists on this Phase 4 surface.</p>
      </section>
    </div>
  )
}
