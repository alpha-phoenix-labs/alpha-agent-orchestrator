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

function Panel({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/10 backdrop-blur-xl ${className}`}
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

export function MissionControl() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const evidenceCount = snapshot?.evidence?.length
  const findingCount = snapshot?.findings?.length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Phase 4.5 · Read-only</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Mission Control</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Backend-owned state is displayed without local write eligibility, verification, blocker or policy inference.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Authority {authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          Authoritative Mission Control snapshot unavailable. Domain state remains UNKNOWN until backend-owned view contracts are supplied.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
        <div className="space-y-4">
          <Panel title="Leader interaction">
            {snapshot?.leader ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.leader} field="agent_id" label="Agent" />
                <ContractValue contract={snapshot.leader} field="role" label="Role" />
                <ContractValue contract={snapshot.leader} field="runtime_state" label="Runtime state" />
                <ContractValue contract={snapshot.leader} field="activity" label="Activity" />
                <div className="sm:col-span-2">
                  <MissingAuthority message="No authoritative Leader interaction-history contract exists. Phase 4.5 exposes no command composer or operational action control." />
                </div>
              </div>
            ) : (
              <MissingAuthority message="No authoritative Leader view contract is present. The UI does not invent Leader identity, activity or interaction state." />
            )}
          </Panel>

          <Panel title="Active Work Order">
            {snapshot?.activeWorkOrder ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={snapshot.activeWorkOrder} field="order_id" label="Order ID" />
                <ContractValue contract={snapshot.activeWorkOrder} field="status" label="Status" />
                <ContractValue contract={snapshot.activeWorkOrder} field="risk" label="Risk" />
                <ContractValue contract={snapshot.activeWorkOrder} field="action" label="Action" />
                <ContractValue contract={snapshot.activeWorkOrder} field="target" label="Target" />
                <ContractValue contract={snapshot.activeWorkOrder} field="base_state_version" label="Base state" />
              </div>
            ) : (
              <MissingAuthority message="No backend-selected active Work Order is available." />
            )}
          </Panel>

          <Panel title="Lifecycle">
            {snapshot?.lifecycle ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.lifecycle} field="order_status" label="Order status" />
                <ContractValue contract={snapshot.lifecycle} field="stage" label="Lifecycle stage" />
              </div>
            ) : (
              <MissingAuthority message="No authoritative lifecycle contract is present. Lifecycle stage is not inferred from Work Order status." />
            )}
          </Panel>

          <Panel title="Current Findings">
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">
              Backend-reported records: {findingCount ?? 'UNKNOWN'}
            </div>
            <ContractList
              contracts={snapshot?.findings}
              emptyMessage="No authoritative Finding collection is present."
              render={(finding, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ContractValue contract={finding} field="claim" label="Claim" />
                    <ContractValue contract={finding} field="reader_id" label="Reader" />
                    <ContractValue contract={finding} field="observation_id" label="Observation" />
                    <ContractValue contract={finding} field="classification" label="Classification" />
                  </div>
                </article>
              )}
            />
          </Panel>

          <Panel title="Evidence Summary">
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">
              Backend-reported references: {evidenceCount ?? 'UNKNOWN'}
            </div>
            <ContractList
              contracts={snapshot?.evidence}
              emptyMessage="No authoritative Evidence collection is present."
              render={(evidence, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={evidence} field="source" label="Source" />
                    <ContractValue contract={evidence} field="reference" label="Reference" />
                    <ContractValue contract={evidence} field="verification_state" label="Verification state" />
                  </div>
                </article>
              )}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Counts are presentation-only. Verification state is displayed as reported by the backend and is not recalculated here.
            </p>
          </Panel>
        </div>

        <aside aria-label="Mission Control rail" className="space-y-4">
          <Panel title="Canonical State">
            {snapshot?.canonicalState ? (
              <div className="space-y-3">
                <ContractValue contract={snapshot.canonicalState} field="repository" label="Repository" />
                <ContractValue contract={snapshot.canonicalState} field="branch" label="Branch" />
                <ContractValue contract={snapshot.canonicalState} field="head_sha" label="HEAD" />
                <ContractValue contract={snapshot.canonicalState} field="observed_at" label="Observed at" />
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label="Freshness" />
              </div>
            ) : (
              <MissingAuthority message="Canonical State is unavailable." />
            )}
          </Panel>

          <Panel title="Gates">
            <ContractList
              contracts={snapshot?.gates}
              emptyMessage="No authoritative gate decisions are present."
              render={(gate, index) => (
                <article key={index} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <ContractValue contract={gate} field="gate_id" label="Gate" />
                  <ContractValue contract={gate} field="allowed" label="Allowed" />
                  <ContractValue contract={gate} field="reason" label="Reason" />
                </article>
              )}
            />
          </Panel>

          <Panel title="Locks">
            <ContractList
              contracts={snapshot?.locks}
              emptyMessage="No authoritative lock collection is present."
              render={(lock, index) => (
                <article key={index} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <ContractValue contract={lock} field="resource" label="Resource" />
                  <ContractValue contract={lock} field="owner" label="Owner" />
                  <ContractValue contract={lock} field="order_id" label="Order ID" />
                </article>
              )}
            />
          </Panel>

          <Panel title="Writer status">
            {snapshot?.writer ? (
              <div className="space-y-3">
                <ContractValue contract={snapshot.writer} field="writer_id" label="Writer" />
                <ContractValue contract={snapshot.writer} field="proposal_only" label="Proposal only" />
                <ContractValue contract={snapshot.writer} field="runtime_state" label="Runtime state" />
              </div>
            ) : (
              <MissingAuthority message="No authoritative writer view is present." />
            )}
          </Panel>

          <Panel title="Blockers">
            <MissingAuthority message="No authoritative Blocker contract exists in the Phase 4.2 view-contract set. The frontend does not reclassify gate denials, lock state or telemetry as blockers." />
          </Panel>
        </aside>
      </div>
    </div>
  )
}
