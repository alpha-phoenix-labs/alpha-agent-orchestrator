import type { ReactNode } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useOperationsData } from './operations-data'

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined || value === '') return 'UNKNOWN'
  return String(value)
}

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
  return (
    <div>
      <p className="font-mono text-sm text-slate-300">UNAVAILABLE</p>
      <p className="mt-1 text-xs text-slate-500">{reason}</p>
    </div>
  )
}

function Field({ contract, field, label }: { contract?: ViewContract; field: string; label: string }) {
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className="mt-1 break-words font-mono text-xs text-slate-300">{formatValue(value)}</p>
      {reason ? <p className="mt-1 text-[11px] text-slate-600">{reason}</p> : null}
    </div>
  )
}

export function TraceWaterfall() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const findings = snapshot?.findings

  return (
    <section aria-label="Trace / Waterfall" className="rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Phase 4.10 · Read-only observability</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">Trace / Waterfall</h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">Roadmap stage order is shown without constructing missing causal links. Timestamps appear only where a backend contract supplies them. Trace/Activity remains observability and is not treated as authoritative Audit.</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Authority {authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}</div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Stage title="Route">
          <Missing reason="NO_ROUTE_STAGE_CONTRACT" />
          <p className="mt-2 text-xs leading-5 text-slate-600">Work Order action or UI navigation is not reclassified as an authoritative routing event.</p>
        </Stage>

        <Stage title="Read">
          {!findings ? (
            <Missing reason="NO_FINDING_PROVENANCE_FOR_READ_TRACE" />
          ) : findings.length === 0 ? (
            <p className="text-sm text-slate-400">0 backend-reported read observations.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, index) => {
                const provenance = nestedContract(finding, 'provenance')
                return (
                  <article key={index} aria-label={`Read trace ${index + 1}`} className="grid gap-3 rounded-md border border-white/10 p-3 sm:grid-cols-2">
                    <Field contract={provenance} field="observation_id" label="Observation" />
                    <Field contract={provenance} field="observed_at" label="Observed at" />
                    <Field contract={provenance} field="source" label="Source" />
                    <Field contract={provenance} field="target_id" label="Target" />
                    <Field contract={provenance} field="status" label="Read status" />
                    <Field contract={provenance} field="transport_id" label="Transport" />
                  </article>
                )
              })}
            </div>
          )}
        </Stage>

        <Stage title="Verify">
          {!findings ? (
            <Missing reason="NO_FINDING_EVIDENCE_FOR_VERIFY_TRACE" />
          ) : findings.length === 0 ? (
            <p className="text-sm text-slate-400">0 backend-reported verification observations.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, index) => {
                const evidence = nestedContract(finding, 'evidence')
                return (
                  <article key={index} aria-label={`Verify trace ${index + 1}`} className="grid gap-3 rounded-md border border-white/10 p-3 sm:grid-cols-2">
                    <Field contract={evidence} field="reference" label="Evidence" />
                    <Field contract={evidence} field="verification_state" label="Verification state" />
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">Verification time</p>
                      <p className="mt-1 font-mono text-xs text-slate-300">UNKNOWN</p>
                      <p className="mt-1 text-[11px] text-slate-600">NO_VERIFICATION_TIMESTAMP_CONTRACT</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Stage>

        <Stage title="Plan">
          {snapshot?.plan ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field contract={snapshot.plan} field="order_id" label="Order" />
              <Field contract={snapshot.plan} field="created_at" label="Created at" />
              <Field contract={snapshot.plan} field="proposed_writer" label="Proposed writer" />
              <Field contract={snapshot.plan} field="simulation_only" label="Simulation only" />
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-600">NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP — the Plan is displayed as its own backend contract and is not causally attached to a Finding by the frontend.</p>
              </div>
            </div>
          ) : <Missing reason="NO_PLAN_TRACE_CONTRACT_AVAILABLE" />}
        </Stage>

        <Stage title="Human Gate">
          <Missing reason="NO_PHASE4_APPROVAL_TRACE_CONTRACT" />
          <p className="mt-2 text-xs leading-5 text-slate-600">Later lifecycle stage only; no approval action or inferred approval state is introduced here.</p>
        </Stage>

        <Stage title="Execution">
          <Missing reason="PHASE4_EXECUTION_NOT_AVAILABLE" />
        </Stage>

        <Stage title="Post Verify">
          <Missing reason="PHASE4_POST_VERIFY_NOT_AVAILABLE" />
        </Stage>
      </div>

      <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-xs leading-5 text-amber-50/70">
        No standalone TRACE contract, route event contract, verification timestamp contract or Finding-to-Plan relationship contract exists. Audit events are not copied into this waterfall to manufacture those missing relationships.
      </div>
    </section>
  )
}
