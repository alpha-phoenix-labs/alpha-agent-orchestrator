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
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="break-words font-mono text-sm text-slate-100">{formattedValue}</span>
      {reason ? <span className="text-xs text-slate-500">{reason}</span> : null}
    </div>
  )
}

function UnavailableValue({ label, reason }: { label: string; reason: string }) {
  const { t } = useI18n()
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="font-mono text-sm text-slate-100">{t('common.unknown')}</span>
      <span className="text-xs text-slate-500">{reason}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
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
  if (!contracts) return <MissingAuthority message={emptyMessage} />
  if (contracts.length === 0) return <p className="text-sm text-slate-400">{t('common.backendRecordsZero')}</p>
  return <div className="space-y-3">{contracts.map(render)}</div>
}

export function SystemSwarm() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t('common.phase48ReadOnly')}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{t('system.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('system.description')}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {t('common.authority')} {authorityAvailable ? t('common.available') : t('common.unavailable')}
        </div>
      </header>

      {!authorityAvailable ? (
        <div role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-50/80">
          {t('system.authorityUnavailable')}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t('system.overview')}>
          <div className="space-y-4">
            {snapshot?.systemState ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} />
                <ContractValue contract={snapshot.systemState} field="state_version" label={t('field.stateVersion')} />
              </div>
            ) : (
              <MissingAuthority message={t('system.noSystemState')} />
            )}

            {snapshot?.canonicalState ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ContractValue contract={snapshot.canonicalState} field="repository" label={t('app.repository')} />
                <ContractValue contract={snapshot.canonicalState} field="branch" label={t('field.branch')} />
                <ContractValue contract={snapshot.canonicalState} field="head_sha" label={t('field.head')} />
                <ContractValue contract={snapshot.canonicalState} field="observed_at" label={t('field.observedAt')} />
                <ContractValue contract={snapshot.canonicalState} field="freshness_result" label={t('field.freshness')} />
              </div>
            ) : (
              <MissingAuthority message={t('system.noCanonicalState')} />
            )}
          </div>
        </Panel>

        <Panel title={t('system.agents')}>
          <ContractList
            contracts={snapshot?.agents}
            emptyMessage={t('system.noAgents')}
            render={(agent, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ContractValue contract={agent} field="agent_id" label={t('field.agent')} />
                  <ContractValue contract={agent} field="role" label={t('field.role')} />
                  <ContractValue contract={agent} field="health" label={t('field.health')} />
                  <ContractValue contract={agent} field="runtime_state" label={t('field.runtimeState')} />
                  <ContractValue contract={agent} field="activity" label={t('field.activity')} />
                </div>
                <div className="mt-3">
                  <MissingAuthority message={t('system.agentTelemetryUnavailable')} />
                </div>
              </article>
            )}
          />
          <p className="mt-3 text-xs leading-5 text-slate-500">{t('system.agentSeparationNote')}</p>
        </Panel>

        <Panel title={t('system.connectors')}>
          <ContractList
            contracts={snapshot?.connectors}
            emptyMessage={t('system.noConnectors')}
            render={(connector, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={connector} field="connector_id" label={t('field.connector')} />
                  <ContractValue contract={connector} field="state" label={t('field.state')} />
                  <ContractValue contract={connector} field="health" label={t('field.health')} />
                  <ContractValue contract={connector} field="auth_state" label={t('field.authState')} />
                </div>
              </article>
            )}
          />
        </Panel>

        <Panel title={t('system.locks')}>
          <ContractList
            contracts={snapshot?.locks}
            emptyMessage={t('system.noLocks')}
            render={(lock, index) => (
              <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ContractValue contract={lock} field="resource" label={t('field.resource')} />
                  <ContractValue contract={lock} field="owner" label={t('field.owner')} />
                  <ContractValue contract={lock} field="order_id" label={t('field.orderId')} />
                  <ContractValue contract={lock} field="acquired_at" label={t('field.acquiredAt')} />
                </div>
              </article>
            )}
          />
        </Panel>

        <Panel title={t('system.policies')}>
          <MissingAuthority message={t('system.noPolicyContract')} />
        </Panel>

        <Panel title={t('system.controlPlane')}>
          <div className="space-y-4">
            {snapshot?.systemState ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.systemState} field="mode" label={t('app.systemMode')} />
                <ContractValue contract={snapshot.systemState} field="writes_enabled" label={t('field.writesEnabled')} />
              </div>
            ) : (
              <MissingAuthority message={t('system.noSystemStateControlPlane')} />
            )}

            <ContractList
              contracts={snapshot?.gates}
              emptyMessage={t('system.noGates')}
              render={(gate, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ContractValue contract={gate} field="gate_id" label={t('field.gate')} />
                    <ContractValue contract={gate} field="allowed" label={t('field.allowed')} />
                    <ContractValue contract={gate} field="reason" label={t('field.reason')} />
                  </div>
                </article>
              )}
            />
            <p className="text-xs leading-5 text-slate-500">{t('system.controlPlaneNote')}</p>
          </div>
        </Panel>

        <Panel title={t('system.health')}>
          <div className="space-y-4">
            {snapshot?.runtime ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.runtime} field="state" label={t('field.runtimeState')} />
                <ContractValue contract={snapshot.runtime} field="observed_at" label={t('field.runtimeObservedAt')} />
              </div>
            ) : (
              <MissingAuthority message={t('system.noRuntime')} />
            )}

            {snapshot?.telemetry ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ContractValue contract={snapshot.telemetry} field="metrics" label={t('field.telemetryMetrics')} />
                <ContractValue contract={snapshot.telemetry} field="observed_at" label={t('field.telemetryObservedAt')} />
              </div>
            ) : (
              <MissingAuthority message={t('system.noTelemetry')} />
            )}

            <MissingAuthority message={t('system.noAggregateHealth')} />
          </div>
        </Panel>

        <Panel title={t('system.liveTopology')}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('common.phase49ReadOnlyTopology')}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('system.topologyNote')}</p>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('system.leaderNode')}</p>
              <div className="mt-3">
                {snapshot?.leader ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ContractValue contract={snapshot.leader} field="agent_id" label={t('field.agent')} />
                    <ContractValue contract={snapshot.leader} field="role" label={t('field.role')} />
                    <ContractValue contract={snapshot.leader} field="runtime_state" label={t('field.runtimeState')} />
                    <ContractValue contract={snapshot.leader} field="activity" label={t('field.activity')} />
                  </div>
                ) : (
                  <MissingAuthority message={t('system.noLeaderNode')} />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('system.workerNodes')}</p>
              <div className="mt-3 space-y-3">
                <MissingAuthority message={t('system.noWorkerMembership')} />
                <ContractList
                  contracts={snapshot?.agents}
                  emptyMessage={t('system.noAgentsForTopology')}
                  render={(agent, index) => (
                    <article key={index} className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <ContractValue contract={agent} field="agent_id" label={t('field.agentNode')} />
                        <ContractValue contract={agent} field="role" label={t('field.role')} />
                        <ContractValue contract={agent} field="activity" label={t('field.activity')} />
                      </div>
                    </article>
                  )}
                />
              </div>
            </div>

            <MissingAuthority message={t('system.noActivityEdge')} />
            <p className="text-xs leading-5 text-slate-500">{t('system.topologySafety')}</p>
          </div>
        </Panel>

        <Panel title={t('system.agentGrid')}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-400">{t('system.agentGridNote')}</p>
            <ContractList
              contracts={snapshot?.agents}
              emptyMessage={t('system.noAgentsForGrid')}
              render={(agent, index) => (
                <article key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ContractValue contract={agent} field="agent_id" label={t('field.agent')} />
                    <ContractValue contract={agent} field="role" label={t('field.role')} />
                    <ContractValue contract={agent} field="health" label={t('field.health')} />
                    <ContractValue contract={agent} field="runtime_state" label={t('field.runtimeState')} />
                    <ContractValue contract={agent} field="activity" label={t('field.activity')} />
                    <UnavailableValue label={t('field.workOrder')} reason="NO_AGENT_WORK_ORDER_ASSOCIATION_CONTRACT" />
                    <UnavailableValue label={t('field.latency')} reason="NO_PER_AGENT_LATENCY_CONTRACT" />
                    <UnavailableValue label={t('field.tokensPerSecond')} reason="NO_PER_AGENT_TOKENS_RATE_CONTRACT" />
                    <UnavailableValue label={t('field.contextUsage')} reason="NO_PER_AGENT_CONTEXT_USAGE_CONTRACT" />
                  </div>
                </article>
              )}
            />
            <p className="text-xs leading-5 text-slate-500">{t('system.globalTelemetryNote')}</p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
