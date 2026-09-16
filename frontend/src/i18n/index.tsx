import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import { deDE, enUS, type MessageKey } from './messages'

export type SupportedLocale = 'de-DE' | 'en-US'
export type TranslationValues = Record<string, string | number>
export type MessageCatalogs = Partial<Record<SupportedLocale, Partial<Record<string, string>>>>

export const supportedLocales: readonly SupportedLocale[] = ['de-DE', 'en-US']
export const fallbackLocale: SupportedLocale = 'en-US'

export const catalogs: MessageCatalogs = {
  'de-DE': deDE,
  'en-US': enUS,
}

export const criticalKeys: readonly MessageKey[] = [
  'common.authority',
  'common.available',
  'common.unavailable',
  'common.unknown',
  'app.viewUnavailable',
  'app.viewUnavailableDetail',
  'mission.authorityUnavailable',
  'work.authorityUnavailable',
  'evidence.authorityUnavailable',
  'system.authorityUnavailable',
  'system.controlPlaneNote',
  'system.topologySafety',
  'trace.boundaryNote',
]

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}

export function resolveMessage(
  key: string,
  locale: SupportedLocale,
  values?: TranslationValues,
  sourceCatalogs: MessageCatalogs = catalogs,
): string {
  const requested = sourceCatalogs[locale]?.[key]
  if (requested !== undefined) return interpolate(requested, values)

  const fallback = sourceCatalogs[fallbackLocale]?.[key]
  if (fallback !== undefined) return interpolate(fallback, values)

  return `LOCALIZATION_ERROR:${key}`
}

export function formatDateTime(value: string | number | Date, locale: SupportedLocale): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatNumber(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function pluralCategory(value: number, locale: SupportedLocale): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(value)
}

type I18nContextValue = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: MessageKey, values?: TranslationValues) => string
  formatDateTime: (value: string | number | Date) => string
  formatNumber: (value: number) => string
  pluralCategory: (value: number) => Intl.LDMLPluralRule
}

const defaultContext: I18nContextValue = {
  locale: fallbackLocale,
  setLocale: () => undefined,
  t: (key, values) => resolveMessage(key, fallbackLocale, values),
  formatDateTime: (value) => formatDateTime(value, fallbackLocale),
  formatNumber: (value) => formatNumber(value, fallbackLocale),
  pluralCategory: (value) => pluralCategory(value, fallbackLocale),
}

const I18nContext = createContext<I18nContextValue>(defaultContext)

type I18nProviderProps = PropsWithChildren<{
  initialLocale?: SupportedLocale
}>

export function I18nProvider({ initialLocale = fallbackLocale, children }: I18nProviderProps) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale)

  const t = useCallback(
    (key: MessageKey, values?: TranslationValues) => resolveMessage(key, locale, values),
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatDateTime: (input) => formatDateTime(input, locale),
      formatNumber: (input) => formatNumber(input, locale),
      pluralCategory: (input) => pluralCategory(input, locale),
    }),
    [locale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
