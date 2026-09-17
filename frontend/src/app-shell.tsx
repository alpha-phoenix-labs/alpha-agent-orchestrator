import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { readAvailableField } from './contracts'
import { useI18n, type SupportedLocale } from './i18n'
import type { MessageKey } from './i18n/messages'
import { useOperationsData } from './operations-data'

const navItems: readonly { to: string; labelKey: MessageKey; end?: boolean }[] = [
  { to: '/', labelKey: 'nav.missionControl', end: true },
  { to: '/work-orders', labelKey: 'nav.workOrders' },
  { to: '/evidence-audit', labelKey: 'nav.evidenceAudit' },
  { to: '/system-swarm', labelKey: 'nav.systemSwarm' },
]

function ActiveContextBar() {
  const {
    currentSnapshot,
    authorityAvailable,
    connectionManaged,
    connectionStatus,
    snapshotStatus,
    viewContextManaged,
    viewContextStatus,
  } = useOperationsData()
  const { t } = useI18n()
  const mode = readAvailableField<string>(currentSnapshot?.systemState, 'mode')
  const repository = readAvailableField<string>(currentSnapshot?.canonicalState, 'repository')
  const branch = readAvailableField<string>(currentSnapshot?.canonicalState, 'branch')
  const headSha = readAvailableField<string>(currentSnapshot?.canonicalState, 'head_sha')
  const connectionValue = connectionManaged
    ? ` · ${connectionStatus} · ${snapshotStatus}`
    : ''
  const viewValue = viewContextManaged ? ` · ${viewContextStatus}` : ''
  const authorityValue = `${authorityAvailable ? t('common.available') : t('common.unavailable')}${connectionValue}${viewValue}`
  const canonicalStateLabel = viewContextManaged
    ? `${t('app.canonicalState')} · CURRENT`
    : t('app.canonicalState')

  return (
    <section
      aria-label={t('app.activeContext')}
      className="operations-context-strip grid gap-3 border-y px-4 py-2.5 text-xs text-slate-300 md:grid-cols-4 md:px-6"
    >
      <ContextItem label={t('common.authority')} value={authorityValue} accent={authorityAvailable} />
      <ContextItem label={t('app.systemMode')} value={mode ?? t('common.unknown')} />
      <ContextItem label={t('app.repository')} value={repository ?? t('common.unknown')} />
      <ContextItem
        label={canonicalStateLabel}
        value={branch && headSha ? `${branch} · ${headSha.slice(0, 12)}` : t('common.unknown')}
      />
    </section>
  )
}

function StateContextBar() {
  const {
    viewContextManaged,
    viewMode,
    viewedStateVersion,
    currentStateVersion,
    viewContextStatus,
    staleContext,
    viewContextReason,
    approvalInvalidationAvailable,
    approvalInvalidationReason,
  } = useOperationsData()
  const { t } = useI18n()

  if (!viewContextManaged) {
    return null
  }

  const warning = staleContext || viewMode === 'HISTORICAL'
  const approvalValue = approvalInvalidationAvailable
    ? t('common.available')
    : `${t('common.unavailable')} · ${approvalInvalidationReason}`

  return (
    <section
      aria-label="STATE CONTEXT"
      role={warning ? 'status' : undefined}
      className={[
        'grid gap-3 border-b px-4 py-2.5 text-xs md:grid-cols-5 md:px-6',
        warning
          ? 'border-amber-300/20 bg-amber-300/5 text-amber-50/80'
          : 'operations-context-strip text-slate-300',
      ].join(' ')}
    >
      <ContextItem label="VIEW MODE" value={viewMode} />
      <ContextItem
        label={`${t('field.stateVersion')} · VIEWED`}
        value={viewedStateVersion ?? t('common.unknown')}
      />
      <ContextItem
        label={`${t('field.stateVersion')} · CURRENT`}
        value={currentStateVersion ?? t('common.unknown')}
      />
      <ContextItem
        label="STATE CONTEXT"
        value={`${viewContextStatus} · ${viewContextReason}`}
      />
      <ContextItem label="APPROVAL INVALIDATION" value={approvalValue} />
    </section>
  )
}

function ContextItem({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <span className={`truncate font-mono ${accent ? 'text-cyan-100' : 'text-slate-100'}`}>{value}</span>
    </div>
  )
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const locales: readonly { value: SupportedLocale; labelKey: MessageKey }[] = [
    { value: 'en-US', labelKey: 'locale.enUS' },
    { value: 'de-DE', labelKey: 'locale.deDE' },
  ]

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1" role="group" aria-label={t('locale.label')}>
      {locales.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={locale === item.value}
          onClick={() => setLocale(item.value)}
          className={[
            'rounded-md px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
            locale === item.value
              ? 'bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.18)]'
              : 'text-slate-500 hover:text-slate-200',
          ].join(' ')}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </div>
  )
}

export function AppShell() {
  const { t } = useI18n()

  return (
    <div className="operations-shell">
      <header className="operations-topbar px-4 md:px-6">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-col gap-3 py-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="operations-brand-mark text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">{t('common.alpha')}</p>
            <h1 className="mt-0.5 text-base font-semibold tracking-tight text-slate-100">{t('common.operationsConsole')}</h1>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <LocaleSwitcher />
            <nav aria-label={t('nav.primary')} className="flex flex-wrap gap-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'relative rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                      isActive
                        ? 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.05)]'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-slate-100',
                    ].join(' ')
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <ActiveContextBar />
      <StateContextBar />

      <main className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-5">
        <ShellErrorBoundary
          errorTitle={t('app.viewUnavailable')}
          errorDetail={t('app.viewUnavailableDetail')}
        >
          <Outlet />
        </ShellErrorBoundary>
      </main>
    </div>
  )
}

export function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  const { t } = useI18n()
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t('common.phase44ShellRoute')}</p>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      <p className="mt-6 text-xs text-slate-500">{t('app.shellDomainDeferred')}</p>
    </section>
  )
}

type ShellErrorBoundaryProps = PropsWithChildren<{
  errorTitle: string
  errorDetail: string
}>
type ShellErrorBoundaryState = { hasError: boolean }

export class ShellErrorBoundary extends Component<ShellErrorBoundaryProps, ShellErrorBoundaryState> {
  state: ShellErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ShellErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error transport belongs to a later observability phase. Do not emit payloads here.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section role="alert" className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">FAILED</p>
          <h2 className="mt-2 text-lg font-semibold text-amber-100">{this.props.errorTitle}</h2>
          <p className="mt-2 text-sm text-amber-50/70">{this.props.errorDetail}</p>
        </section>
      )
    }

    return this.props.children
  }
}
