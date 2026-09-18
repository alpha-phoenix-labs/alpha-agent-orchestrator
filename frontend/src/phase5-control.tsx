import { type FormEvent, useMemo, useState } from 'react'

import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'
import {
  Phase5ControlClient,
  Phase5ControlClientError,
  type Phase5ApprovalBinding,
  type Phase5ControlState,
} from './phase5-control-client'

type ControlClient = Pick<Phase5ControlClient, 'fetchState' | 'approve' | 'execute'>

function controlFeatureEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_PHASE5_SANDBOX_CONTROL !== 'true') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('sandboxControl') === 'phase5'
}

function contract(state: Phase5ControlState | null, name: string): ViewContract | undefined {
  return state?.contracts.find((item) => item.contract === name)
}

function knownString(view: ViewContract | undefined, field: string): string | null {
  const value = readAvailableField<unknown>(view, field)
  return typeof value === 'string' && value.length > 0 ? value : null
}

function bindingFromApproval(view: ViewContract | undefined): Phase5ApprovalBinding | null {
  const orderId = knownString(view, 'order_id')
  const action = knownString(view, 'action')
  const target = knownString(view, 'target')
  const baseSha = knownString(view, 'base_sha')
  const baseStateVersion = knownString(view, 'base_state_version')
  const planHash = knownString(view, 'plan_hash')
  const risk = knownString(view, 'risk')
  if (!orderId || !action || !target || !baseSha || !baseStateVersion || !planHash || !risk) {
    return null
  }
  return {
    order_id: orderId,
    action,
    target,
    base_sha: baseSha,
    base_state_version: baseStateVersion,
    plan_hash: planHash,
    risk,
  }
}

function ControlValue({
  view,
  field,
  label,
}: {
  view?: ViewContract
  field: string
  label: string
}) {
  const { t } = useI18n()
  const value = readAvailableField<unknown>(view, field)
  const reason = readUnavailableReason(view, field)
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-slate-100">
        {value === null || value === undefined || value === '' ? t('common.unknown') : String(value)}
      </div>
      {reason ? <div className="mt-1 text-[11px] text-slate-500">{reason}</div> : null}
    </div>
  )
}

export function Phase5SandboxControlPanel({
  enabled = controlFeatureEnabled(),
  clientFactory = (credential) =>
    new Phase5ControlClient({
      baseUrl: import.meta.env.VITE_PHASE5_SANDBOX_CONTROL_BASE_URL ?? '',
      bearerCredential: credential,
    }),
}: {
  enabled?: boolean
  clientFactory?: (credential: string) => ControlClient
}) {
  const { t } = useI18n()
  const [credential, setCredential] = useState('')
  const [client, setClient] = useState<ControlClient | null>(null)
  const [state, setState] = useState<Phase5ControlState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [approvalPhrase, setApprovalPhrase] = useState('')
  const [executionPhrase, setExecutionPhrase] = useState('')

  const approval = contract(state, 'APPROVAL')
  const capability = contract(state, 'CAPABILITY')
  const execution = contract(state, 'EXECUTION')
  const postVerify = contract(state, 'POST_VERIFY')
  const binding = useMemo(() => bindingFromApproval(approval), [approval])
  const approvalState = knownString(approval, 'state')
  const approvalId = knownString(approval, 'approval_id')
  const expectedApproval = binding ? `APPROVE ${binding.order_id}` : null
  const expectedExecution = binding ? `EXECUTE ${binding.order_id}` : null

  async function load(nextClient: ControlClient) {
    setBusy(true)
    setError(null)
    try {
      setState(await nextClient.fetchState())
    } catch (err) {
      setState(null)
      setError(err instanceof Phase5ControlClientError ? err.code : 'PHASE5_CONTROL_STATE_FAILED')
    } finally {
      setBusy(false)
    }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let nextClient: ControlClient
    try {
      nextClient = clientFactory(credential)
    } catch (err) {
      setError(err instanceof Phase5ControlClientError ? err.code : 'PHASE5_CONTROL_CONNECT_FAILED')
      return
    }
    setCredential('')
    setClient(nextClient)
    await load(nextClient)
  }

  async function approve() {
    if (!client || !binding || !expectedApproval || approvalPhrase !== expectedApproval) return
    setBusy(true)
    setError(null)
    try {
      setState(await client.approve(binding))
      setApprovalPhrase('')
    } catch (err) {
      setError(err instanceof Phase5ControlClientError ? err.code : 'PHASE5_APPROVAL_FAILED')
    } finally {
      setBusy(false)
    }
  }

  async function execute() {
    if (!client || !binding || !approvalId || !expectedExecution || executionPhrase !== expectedExecution) return
    setBusy(true)
    setError(null)
    try {
      setState(await client.execute({ orderId: binding.order_id, approvalId }))
      setExecutionPhrase('')
    } catch (err) {
      setError(err instanceof Phase5ControlClientError ? err.code : 'PHASE5_EXECUTION_FAILED')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) return null

  return (
    <section
      aria-label={t('phase5.title')}
      className="rounded-xl border border-cyan-300/20 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">SANDBOX_WRITE · HUMAN GATE</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">{t('phase5.title')}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t('phase5.description')}</p>
        </div>
        {client ? (
          <button
            type="button"
            className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200"
            onClick={() => {
              setClient(null)
              setState(null)
              setError(null)
              setApprovalPhrase('')
              setExecutionPhrase('')
            }}
          >
            {t('phase5.disconnect')}
          </button>
        ) : null}
      </div>

      {!client ? (
        <form onSubmit={connect} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
            <span>{t('phase5.token')}</span>
            <input
              aria-label={t('phase5.token')}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </label>
          <button
            type="submit"
            disabled={!credential || busy}
            className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('phase5.requestPending') : t('phase5.connect')}
          </button>
        </form>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-md border border-rose-300/25 bg-rose-300/5 px-3 py-2 font-mono text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {client && !state ? (
        <div role="status" className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-50/80">
          {t('phase5.noState')}
        </div>
      ) : null}

      {state && approval ? (
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-200">{t('phase5.approvalReview')}</h4>
              <button
                type="button"
                disabled={busy || !client}
                onClick={() => client && load(client)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
              >
                {t('phase5.refresh')}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ControlValue view={approval} field="order_id" label={t('field.orderId')} />
              <ControlValue view={approval} field="state" label={t('field.approvalState')} />
              <ControlValue view={approval} field="risk" label={t('field.risk')} />
              <ControlValue view={approval} field="action" label={t('field.action')} />
              <ControlValue view={approval} field="target" label={t('field.target')} />
              <ControlValue view={approval} field="base_sha" label={t('field.baseSha')} />
              <ControlValue view={approval} field="base_state_version" label={t('field.baseState')} />
              <ControlValue view={approval} field="plan_hash" label={t('field.planHash')} />
              <ControlValue view={approval} field="approval_id" label={t('field.approvalId')} />
              <ControlValue view={approval} field="expires_at" label={t('field.expiresAt')} />
            </div>

            {approvalState === 'PENDING' && binding && expectedApproval ? (
              <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4">
                <label className="block text-xs text-amber-100/80">
                  <span>{t('phase5.approvalPhrase', { orderId: binding.order_id })}</span>
                  <input
                    aria-label={t('phase5.approvalPhrase', { orderId: binding.order_id })}
                    value={approvalPhrase}
                    onChange={(event) => setApprovalPhrase(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-2 w-full rounded-md border border-amber-300/20 bg-black/30 px-3 py-2 font-mono text-sm text-amber-50 outline-none focus:border-amber-300/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy || approvalPhrase !== expectedApproval}
                  className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? t('phase5.requestPending') : `${t('phase5.approveAction')} · ${binding.order_id}`}
                </button>
              </div>
            ) : null}

            {approvalState === 'APPROVED' && binding && approvalId && expectedExecution ? (
              <div className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/5 p-4">
                <label className="block text-xs text-rose-100/80">
                  <span>{t('phase5.executionPhrase', { orderId: binding.order_id })}</span>
                  <input
                    aria-label={t('phase5.executionPhrase', { orderId: binding.order_id })}
                    value={executionPhrase}
                    onChange={(event) => setExecutionPhrase(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-2 w-full rounded-md border border-rose-300/20 bg-black/30 px-3 py-2 font-mono text-sm text-rose-50 outline-none focus:border-rose-300/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={execute}
                  disabled={busy || executionPhrase !== expectedExecution}
                  className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? t('phase5.requestPending') : `${t('phase5.executeAction')} · ${binding.order_id}`}
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{t('phase5.capability')}</h4>
              {capability ? (
                <div className="grid gap-2">
                  <ControlValue view={capability} field="capability_id" label={t('field.capabilityId')} />
                  <ControlValue view={capability} field="scope" label={t('field.scope')} />
                  <ControlValue view={capability} field="target" label={t('field.target')} />
                  <ControlValue view={capability} field="expires_at" label={t('field.expiresAt')} />
                  <ControlValue view={capability} field="consumed_state" label={t('field.consumedState')} />
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t('common.unavailable')}</p>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{t('phase5.execution')}</h4>
              {execution ? (
                <div className="grid gap-2">
                  <ControlValue view={execution} field="execution_id" label={t('field.executionId')} />
                  <ControlValue view={execution} field="state" label={t('field.state')} />
                  <ControlValue view={execution} field="detail" label={t('field.detail')} />
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t('common.unavailable')}</p>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{t('phase5.postVerify')}</h4>
              {postVerify ? (
                <div className="grid gap-2">
                  <ControlValue view={postVerify} field="state" label={t('field.postVerifyState')} />
                  <ControlValue view={postVerify} field="reason" label={t('field.postVerifyReason')} />
                  <ControlValue view={postVerify} field="observed_sha" label={t('field.observedSha')} />
                  <ControlValue view={postVerify} field="artifact_digest" label={t('field.artifactDigest')} />
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t('common.unavailable')}</p>
              )}
            </div>
          </div>

          <p className="text-xs leading-5 text-slate-500">{t('phase5.safety')}</p>
        </div>
      ) : null}
    </section>
  )
}
