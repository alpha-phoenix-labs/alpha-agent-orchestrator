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
  if (typeof value === 'object') {
    return JSON.stringify(value)
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

function UnavailableValue({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <span className="font-mono text-sm text-slate-100">UNKNOWN</span>
      <span className="text-xs text-slate-500">{reason}</span>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
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

export function SystemSwarm() {
  const { snapshot, authorityAvailable } = useOperationsData()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Phase 4.8 · Read-only</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">System / Swarm</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            System, agent and connector facts remain separated by backend source class. Missing runtime, telemetry, policy and health authority is shown explicitly instead of inferred.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          Authority {authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          Authoritative System / Swarm snapshot unavailable. Domain and runtime state remain UNKNOWN until backend-owned view contracts are supplied.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="System Overview">
          <div className="space-y-4">
            {snapshot?.systemState ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <ContractValue contract={snapshot.systemState} field="mode" label="System mode" />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label="Writes enabled" />
                <ContractValue contract={snapshot.systemState} field="state_version" label="State version" />
              </div>
            ) : (
              <MissingAuthority message="No authoritative SYSTEM_STATE contract is present." />
            )}

            {snapshot?.canonicalState ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={snapshot.canonicalState} field="repository" label="Repository" />
                <ContractValue contract={snapshot.canonicalState} field="branch" label="Branch" />
                <ContractValue contract={snapshot.canonicalState} field="head_sha" label="HEAD" />
                <ContractValue contract={snapshot.canonicalState} field="observed_at" label="Observed at" />
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label="Freshness" />
              </div>
            ) : (
              <MissingAuthority message="No authoritative CANONICAL_STATE contract is present." />
            )}
          </div>
        </Panel>

        <Panel title="Agents">
          <ContractList
            contracts={snapshot?.agents}
            emptyMessage="No AGENT view contracts are present. Agent identity, Health, Runtime State and Activity remain UNKNOWN."
            render={(agent, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={agent} field="agent_id" label="Agent" />
                  <ContractValue contract={agent} field="role" label="Role" />
                  <ContractValue contract={agent} field="health" label="Health" />
                  <ContractValue contract={agent} field="runtime_state" label="Runtime State" />
                  <ContractValue contract={agent} field="activity" label="Activity" />
                </div>
                <div className="mt-3">
                  <MissingAuthority message="NO_PER_AGENT_TELEMETRY_CONTRACT — global TELEMETRY is not re-labeled as per-agent telemetry." />
                </div>
              </article>
            )}
          />
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Health, Runtime State, Activity and Telemetry are separate concepts. Activity values such as THINKING are never interpreted as Health or permission state.
          </p>
        </Panel>

        <Panel title="Connectors">
          <ContractList
            contracts={snapshot?.connectors}
            emptyMessage="No CONNECTOR view contracts are present. Connector identity, state, health and auth state remain UNKNOWN."
            render={(connector, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={connector} field="connector_id" label="Connector" />
                  <ContractValue contract={connector} field="state" label="State" />
                  <ContractValue contract={connector} field="health" label="Health" />
                  <ContractValue contract={connector} field="auth_state" label="Auth state" />
                </div>
              </article>
            )}
          />
        </Panel>

        <Panel title="Locks">
          <ContractList
            contracts={snapshot?.locks}
            emptyMessage="No authoritative LOCK collection is present."
            render={(lock, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={lock} field="resource" label="Resource" />
                  <ContractValue contract={lock} field="owner" label="Owner" />
                  <ContractValue contract={lock} field="order_id" label="Order ID" />
                  <ContractValue contract={lock} field="acquired_at" label="Acquired at" />
                </div>
              </article>
            )}
          />
        </Panel>

        <Panel title="Policies">
          <MissingAuthority message="NO_POLICY_VIEW_CONTRACT — repository policy configuration is not promoted into runtime or security authority without an explicit backend view contract." />
        </Panel>

        <Panel title="Control Plane">
          <div className="space-y-4">
            {snapshot?.systemState ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.systemState} field="mode" label="System mode" />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label="Writes enabled" />
              </div>
            ) : (
              <MissingAuthority message="No SYSTEM_STATE contract is present for Control Plane facts." />
            )}

            <ContractList
              contracts={snapshot?.gates}
              emptyMessage="No authoritative GATE decisions are present."
              render={(gate, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ContractValue contract={gate} field="gate_id" label="Gate" />
                    <ContractValue contract={gate} field="allowed" label="Allowed" />
                    <ContractValue contract={gate} field="reason" label="Reason" />
                  </div>
                </article>
              )}
            />
            <p className="text-xs leading-5 text-slate-500">
              This surface exposes no agent command, writer enablement, policy override, force unlock, force deploy or force approval control.
            </p>
          </div>
        </Panel>

        <Panel title="System Health">
          <div className="space-y-4">
            {snapshot?.runtime ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.runtime} field="state" label="Runtime state" />
                <ContractValue contract={snapshot.runtime} field="observed_at" label="Runtime observed at" />
              </div>
            ) : (
              <MissingAuthority message="No RUNTIME view contract is present." />
            )}

            {snapshot?.telemetry ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.telemetry} field="metrics" label="Telemetry metrics" />
                <ContractValue contract={snapshot.telemetry} field="observed_at" label="Telemetry observed at" />
              </div>
            ) : (
              <MissingAuthority message="No TELEMETRY view contract is present." />
            )}

            <MissingAuthority message="NO_AGGREGATE_SYSTEM_HEALTH_CONTRACT — the UI does not derive a health verdict from Runtime, Telemetry, Agents, Connectors, Gates or Locks." />
          </div>
        </Panel>

        <Panel title="Live Topology">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Phase 4.9 · read-only topology</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Node placement is presentation-only. Topology relationships are shown only when backed by explicit backend contracts.
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Leader node</p>
              <div className="mt-3">
                {snapshot?.leader ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ContractValue contract={snapshot.leader} field="agent_id" label="Agent" />
                    <ContractValue contract={snapshot.leader} field="role" label="Role" />
                    <ContractValue contract={snapshot.leader} field="runtime_state" label="Runtime State" />
                    <ContractValue contract={snapshot.leader} field="activity" label="Activity" />
                  </div>
                ) : (
                  <MissingAuthority message="NO_BACKEND_SELECTED_LEADER_NODE — the frontend does not promote an Agent into Leader state by role, position or activity." />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Worker nodes</p>
              <div className="mt-3 space-y-3">
                <MissingAuthority message="NO_EXPLICIT_WORKER_MEMBERSHIP_CONTRACT — available AGENT contracts are not classified as workers by the frontend." />
                <ContractList
                  contracts={snapshot?.agents}
                  emptyMessage="No AGENT contracts are available for topology presentation."
                  render={(agent, index) => (
                    <article key={index} className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <ContractValue contract={agent} field="agent_id" label="Agent node" />
                        <ContractValue contract={agent} field="role" label="Role" />
                        <ContractValue contract={agent} field="activity" label="Activity" />
                      </div>
                    </article>
                  )}
                />
              </div>
            </div>

            <MissingAuthority message="NO_RUNTIME_ACTIVITY_EDGE_CONTRACT — the frontend does not create or animate Agent-to-Agent or Leader-to-Agent activity edges from co-occurrence, Activity, Audit or Telemetry." />
            <p className="text-xs leading-5 text-slate-500">
              Safety semantics: animated edge ≠ verified; glow ≠ approved; active agent ≠ write permitted. This view adds no verification, approval or write authority.
            </p>
          </div>
        </Panel>

        <Panel title="Agent Grid">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-400">
              Grid rows expose backend-supplied Agent facts only. Work Order association and per-Agent performance telemetry stay UNKNOWN until explicitly modeled.
            </p>
            <ContractList
              contracts={snapshot?.agents}
              emptyMessage="No AGENT contracts are available for the Agent Grid."
              render={(agent, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={agent} field="agent_id" label="Agent" />
                    <ContractValue contract={agent} field="role" label="Role" />
                    <ContractValue contract={agent} field="health" label="Health" />
                    <ContractValue contract={agent} field="runtime_state" label="Runtime State" />
                    <ContractValue contract={agent} field="activity" label="Activity" />
                    <UnavailableValue label="Work Order" reason="NO_AGENT_WORK_ORDER_ASSOCIATION_CONTRACT" />
                    <UnavailableValue label="Latency" reason="NO_PER_AGENT_LATENCY_CONTRACT" />
                    <UnavailableValue label="Tokens / s" reason="NO_PER_AGENT_TOKENS_RATE_CONTRACT" />
                    <UnavailableValue label="Context usage" reason="NO_PER_AGENT_CONTEXT_USAGE_CONTRACT" />
                  </div>
                </article>
              )}
            />
            <p className="text-xs leading-5 text-slate-500">
              Global TELEMETRY is never redistributed across Agent rows. No latency, token rate, context usage or Work Order relationship is inferred from unrelated collections.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
