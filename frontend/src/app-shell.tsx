import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { readAvailableField } from './contracts'
import { useOperationsData } from './operations-data'

const navItems = [
  { to: '/', label: 'Mission Control', end: true },
  { to: '/work-orders', label: 'Work Orders' },
  { to: '/evidence-audit', label: 'Evidence & Audit' },
  { to: '/system-swarm', label: 'System / Swarm' },
] as const

function ActiveContextBar() {
  const { snapshot, authorityAvailable } = useOperationsData()
  const mode = readAvailableField<string>(snapshot?.systemState, 'mode')
  const repository = readAvailableField<string>(snapshot?.canonicalState, 'repository')
  const branch = readAvailableField<string>(snapshot?.canonicalState, 'branch')
  const headSha = readAvailableField<string>(snapshot?.canonicalState, 'head_sha')

  return (
    <section
      aria-label="Active context"
      className="grid gap-3 border-y border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 md:grid-cols-4 md:px-6"
    >
      <ContextItem label="Authority" value={authorityAvailable ? 'AVAILABLE' : 'UNAVAILABLE'} />
      <ContextItem label="System mode" value={mode ?? 'UNKNOWN'} />
      <ContextItem label="Repository" value={repository ?? 'UNKNOWN'} />
      <ContextItem
        label="Canonical state"
        value={branch && headSha ? `${branch} · ${headSha.slice(0, 12)}` : 'UNKNOWN'}
      />
    </section>
  )
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="truncate font-mono text-slate-100">{value}</span>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#05070A] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">ALPHA</p>
            <h1 className="text-lg font-semibold tracking-tight">Operations Console</h1>
          </div>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : undefined}
                className={({ isActive }) =>
                  [
                    'rounded-md border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                    isActive
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <ActiveContextBar />

      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        <ShellErrorBoundary>
          <Outlet />
        </ShellErrorBoundary>
      </main>
    </div>
  )
}

export function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Phase 4.4 shell route</p>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      <p className="mt-6 text-xs text-slate-500">
        Domain data is intentionally not implemented in the app-shell phase.
      </p>
    </section>
  )
}

type ShellErrorBoundaryState = { hasError: boolean }

export class ShellErrorBoundary extends Component<PropsWithChildren, ShellErrorBoundaryState> {
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
          <h2 className="text-lg font-semibold text-amber-100">View unavailable</h2>
          <p className="mt-2 text-sm text-amber-50/70">
            This view failed in isolation. No system authority or write eligibility is inferred from the failure.
          </p>
        </section>
      )
    }

    return this.props.children
  }
}
