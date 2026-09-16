import type { ReactNode } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useOperationsData } from './operations-data'

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (value === null || value === undefined || value === '') {
    return 'UNKNOWN'
  }
  return String(value)
}

function ContractValue({
  contract,
  field,
  label,
}: {
  contract?: ViewContract
  field: string
  label: string
}) {
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <span className="break-words font-mono text-sm text-slate-100">{formatValue(value)}</span>
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
  return (
    <div className="rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-sm text-amber-50/80">
      <strong className="font-semibold text-amber-100">UNAVAILABLE</strong>
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
  if (!contracts) {
    return <MissingAuthority message={emptyMessage} />
  }

  if (contracts.length === 0) {
    return <p className="text-sm text-slate-400">0 backend-reported records.</p>
  }

  return <div className="space-y-3">{contracts.map(render)}</div>
}

export function WorkOrders() {
  const { snapshot, authorityAvailable } = useOperationsData()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Phase 4.6 · Read-only</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Work Orders</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Backend-owned Work Order state is displayed without local approval, execution, verification, lifecycle-stage or policy inference.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Authority {authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          Authoritative Work Order snapshot unavailable. The page remains read-only and does not synthesize domain state.
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        Collections are rendered exactly as supplied by the snapshot. Cross-record relationships are not inferred when the backend contract does not provide them.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Overview">
          <ContractList
            contracts={snapshot?.workOrders}
            emptyMessage="No authoritative Work Order collection is present."
            render={(order, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={order} field="order_id" label="Order ID" />
                  <ContractValue contract={order} field="status" label="Status" />
                  <ContractValue contract={order} field="risk" label="Risk" />
                  <ContractValue contract={order} field="action" label="Action" />
                  <ContractValue contract={order} field="target" label="Target" />
                  <ContractValue contract={order} field="base_state_version" label="Base state" />
                  <ContractValue contract={order} field="expected_effect" label="Expected effect" />
                  <ContractValue contract={order} field="evidence_verified" label="Evidence verified" />
                  <ContractValue
                    contract={order}
                    field="independent_review_confirmed"
                    label="Independent review"
                  />
                  <ContractValue contract={order} field="plan_hash" label="Plan hash" />
                  <ContractValue contract={order} field="created_at" label="Created at" />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title="Lifecycle">
          {snapshot?.lifecycle ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ContractValue contract={snapshot.lifecycle} field="order_status" label="Order status" />
              <ContractValue contract={snapshot.lifecycle} field="stage" label="Lifecycle stage" />
            </div>
          ) : (
            <MissingAuthority message="No authoritative Lifecycle contract is present. Lifecycle stage is not derived from OrderStatus." />
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Approval, Execution and Post Verify remain non-operative until their backend-owned Phase 5 contracts and controls exist.
          </p>
        </Section>

        <Section title="Evidence">
          <ContractList
            contracts={snapshot?.evidence}
            emptyMessage="No authoritative Evidence collection is present."
            render={(evidence, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={evidence} field="source" label="Source" />
                  <ContractValue contract={evidence} field="reference" label="Reference" />
                  <ContractValue contract={evidence} field="observed_at" label="Observed at" />
                  <ContractValue contract={evidence} field="digest" label="Digest" />
                  <ContractValue contract={evidence} field="verification_state" label="Verification state" />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title="Findings">
          <ContractList
            contracts={snapshot?.findings}
            emptyMessage="No authoritative Finding collection is present."
            render={(finding, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={finding} field="reader_id" label="Reader" />
                  <ContractValue contract={finding} field="claim" label="Claim" />
                  <ContractValue contract={finding} field="observation_id" label="Observation" />
                  <ContractValue contract={finding} field="classification" label="Classification" />
                </div>
              </article>
            )}
          />
        </Section>

        <Section title="Plan">
          {snapshot?.plan ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ContractValue contract={snapshot.plan} field="order_id" label="Order ID" />
              <ContractValue contract={snapshot.plan} field="action" label="Action" />
              <ContractValue contract={snapshot.plan} field="target" label="Target" />
              <ContractValue contract={snapshot.plan} field="expected_effect" label="Expected effect" />
              <ContractValue contract={snapshot.plan} field="risk" label="Risk" />
              <ContractValue contract={snapshot.plan} field="base_state_version" label="Base state" />
              <ContractValue contract={snapshot.plan} field="plan_hash" label="Plan hash" />
              <ContractValue contract={snapshot.plan} field="proposed_writer" label="Proposed writer" />
              <ContractValue contract={snapshot.plan} field="created_at" label="Created at" />
              <ContractValue contract={snapshot.plan} field="simulation_only" label="Simulation only" />
            </div>
          ) : (
            <MissingAuthority message="No authoritative Plan contract is present for the current Work Order context." />
          )}
        </Section>

        <Section title="Audit">
          <ContractList
            contracts={snapshot?.audit}
            emptyMessage="No authoritative Audit collection is present."
            render={(event, index) => (
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
            )}
          />
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Raw Audit payload remains unavailable when the backend marks it unsafe for UI display.
          </p>
        </Section>
      </div>
    </div>
  )
}
