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
    <div className={`alphan-data-cell ${compact ? 'alphan-data-cell--compact' : ''}`}>
      <span className="alphan-data-label">{label}</span>
      <span className="alphan-data-value">{formattedValue}</span>
      {reason ? <span className="alphan-data-reason">{reason}</span> : null}
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
    <section aria-label={title} className={`alphan-panel ${className}`}>
      <div className="alphan-panel-heading">
        <div className="min-w-0">
          {eyebrow ? <p className="alphan-panel-eyebrow">{eyebrow}</p> : null}
          <h3 className="alphan-panel-title">{title}</h3>
        </div>
        <span className="alphan-panel-light" aria-hidden="true" />
      </div>
      <div className="alphan-panel-body">
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
    <div className={`alphan-unavailable ${compact ? 'alphan-unavailable--compact' : ''}`}>
      <div className="alphan-unavailable-title">
        <span className="alphan-status-dot alphan-status-dot--warning" aria-hidden="true" />
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
  className = 'alphan-list',
}: {
  contracts: readonly ViewContract[] | undefined
  emptyMessage: string
  render: (contract: ViewContract, index: number) => ReactNode
  className?: string
}) {
  const { t } = useI18n()
  if (!contracts) return <MissingAuthority message={emptyMessage} compact />
  if (contracts.length === 0) return <p className="alphan-empty">{t('common.backendRecordsZero')}</p>
  return <div className={className}>{contracts.map(render)}</div>
}
