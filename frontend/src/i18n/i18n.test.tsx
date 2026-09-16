import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { routes } from '../App'
import type { OperationsSnapshot } from '../contracts'
import { OperationsDataProvider, useOperationsData } from '../operations-data'
import {
  criticalKeys,
  formatDateTime,
  formatNumber,
  I18nProvider,
  pluralCategory,
  resolveMessage,
  useI18n,
} from '.'
import { deDE, enUS } from './messages'

afterEach(cleanup)

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort()
}

function LocaleAndStateProbe() {
  const { locale, setLocale, t } = useI18n()
  const { snapshot } = useOperationsData()
  return (
    <div>
      <p>{locale}</p>
      <p>{t('work.title')}</p>
      <pre data-testid="snapshot">{JSON.stringify(snapshot)}</pre>
      <button type="button" onClick={() => setLocale('de-DE')}>Deutsch</button>
    </div>
  )
}

describe('ROADMAP-AMENDMENT-I18N-001', () => {
  it('keeps the required en-US and de-DE key sets in parity', () => {
    expect(Object.keys(deDE).sort()).toEqual(Object.keys(enUS).sort())
  })

  it('keeps placeholder names identical between supported locales', () => {
    for (const key of Object.keys(enUS) as Array<keyof typeof enUS>) {
      expect(placeholders(deDE[key])).toEqual(placeholders(enUS[key]))
    }
  })

  it('contains every critical key in both supported catalogs', () => {
    for (const key of criticalKeys) {
      expect(enUS[key]).toBeTruthy()
      expect(deDE[key]).toBeTruthy()
    }
  })

  it('falls back deterministically to en-US and fails visibly if the baseline is absent', () => {
    expect(resolveMessage('critical.example', 'de-DE', undefined, {
      'de-DE': {},
      'en-US': { 'critical.example': 'English safety baseline' },
    })).toBe('English safety baseline')

    expect(resolveMessage('critical.missing', 'de-DE', undefined, {
      'de-DE': {},
      'en-US': {},
    })).toBe('LOCALIZATION_ERROR:critical.missing')
  })

  it('supports locale-aware formatters and plural rules without changing source values', () => {
    const sourceNumber = 1234.5
    const sourceDate = '2026-09-16T20:42:15Z'

    expect(formatNumber(sourceNumber, 'de-DE')).not.toBe(formatNumber(sourceNumber, 'en-US'))
    expect(formatDateTime(sourceDate, 'de-DE')).not.toBe(formatDateTime(sourceDate, 'en-US'))
    expect(pluralCategory(1, 'de-DE')).toBe('one')
    expect(pluralCategory(2, 'en-US')).toBe('other')
    expect(sourceNumber).toBe(1234.5)
    expect(sourceDate).toBe('2026-09-16T20:42:15Z')
  })

  it('switches interface locale without mutating the operations snapshot', async () => {
    const user = userEvent.setup()
    const snapshot: OperationsSnapshot = {
      systemState: {
        contract: 'SYSTEM_STATE',
        fields: {
          mode: { source_class: 'AUTHORITATIVE', available: true, value: 'SHADOW', reason: null },
          writes_enabled: { source_class: 'AUTHORITATIVE', available: true, value: false, reason: null },
        },
      },
    }
    const before = JSON.stringify(snapshot)

    render(
      <I18nProvider initialLocale="en-US">
        <OperationsDataProvider snapshot={snapshot}>
          <LocaleAndStateProbe />
        </OperationsDataProvider>
      </I18nProvider>,
    )

    expect(screen.getByText('Work Orders')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deutsch' }))
    expect(screen.getByText('Arbeitsaufträge')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot')).toHaveTextContent(before)
    expect(JSON.stringify(snapshot)).toBe(before)
  })

  it.each([
    ['/', 'Mission Control'],
    ['/work-orders', 'Arbeitsaufträge'],
    ['/evidence-audit', 'Evidence & Audit'],
    ['/system-swarm', 'System / Schwarm'],
  ])('renders the current Phase-4 route %s in de-DE', (path, heading) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] })
    render(
      <I18nProvider initialLocale="de-DE">
        <OperationsDataProvider>
          <RouterProvider router={router} />
        </OperationsDataProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve|execute|deploy|unlock|writer/i })).not.toBeInTheDocument()
  })
})
