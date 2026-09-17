import type { ReactNode } from 'react'

import { ShellErrorBoundary } from './app-shell'
import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'
import { useI18n } from './i18n'

export function displayValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ContractValue({
  contract,
  field,
  label,
  compact = false,
}: {
  contract?: ViewContract
  field: string
  label: string
  compact?: boolean
}) {
  const { t } = useI18n()
  const value = readAvailableField<unknown>(contract, field)
  const reason = readUnavailableReason(contract, field)
  const formattedValue =
    typeof value === 'boolean'
      ? value
        ? t('common.true')
        : t('common.false')
      : displayValue(value, t('common.unknown'))

  return (
    <div className={`alpha-data-cell ${compact ? 'alpha-data-cell--compact' : ''}`}>
      <span className="alpha-data-label">{label}</span>
      <span className="alpha-data-value">{formattedValue}</span>
      {reason ? <span className="alpha-data-reason">{reason}</span> : null}
    </div>
  )
}

export function Panel({
  title,
  children,
  className = '',
  eyebrow,
}: {
  title: string
  children: ReactNode
  className?: string
  eyebrow?: string
}) {
  const { t } = useI18n()
  return (
    <section aria-label={title} className={`alpha-panel ${className}`}>
      <div className="alpha-panel-heading">
        <div className="min-w-0">
          {eyebrow ? <p className="alpha-panel-eyebrow">{eyebrow}</p> : null}
          <h3 className="alpha-panel-title">{title}</h3>
        </div>
        <span className="alpha-panel-light" aria-hidden="true" />
      </div>
      <div className="alpha-panel-body">
        <ShellErrorBoundary
          errorTitle={t('app.viewUnavailable')}
          errorDetail={t('app.viewUnavailableDetail')}
        >
          {children}
        </ShellErrorBoundary>
      </div>
    </section>
  )
}

export function MissingAuthority({ message, compact = false }: { message: string; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className={`alpha-unavailable ${compact ? 'alpha-unavailable--compact' : ''}`}>
      <div className="alpha-unavailable-title">
        <span className="alpha-status-dot alpha-status-dot--warning" aria-hidden="true" />
        <strong>{t('common.unavailable')}</strong>
      </div>
      <p>{message}</p>
    </div>
  )
}

export function ContractList({
  contracts,
  emptyMessage,
  render,
  className = 'alpha-list',
}: {
  contracts: readonly ViewContract[] | undefined
  emptyMessage: string
  render: (contract: ViewContract, index: number) => ReactNode
  className?: string
}) {
  const { t } = useI18n()
  if (!contracts) return <MissingAuthority message={emptyMessage} compact />
  if (contracts.length === 0) return <p className="alpha-empty">{t('common.backendRecordsZero')}</p>
  return <div className={className}>{contracts.map(render)}</div>
}
