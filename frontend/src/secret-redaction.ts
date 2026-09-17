import type { OperationsSnapshot, ViewContract, ViewField } from './contracts'

export const REDACTED_DISPLAY_VALUE = '[REDACTED]'

const SENSITIVE_FIELD_NAMES = new Set([
  'apikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'bearertoken',
  'authorization',
  'authorizationheader',
  'cookie',
  'setcookie',
  'password',
  'passwd',
  'privatekey',
  'capabilitytoken',
  'rawcapabilitytoken',
  'credential',
  'credentials',
  'clientsecret',
  'secret',
  'webhooksecret',
  'signingsecret',
])

const BEARER_PATTERN = /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i
const COOKIE_PATTERN = /\b(?:cookie|set-cookie)\s*[:=]\s*\S+/i
const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/
const COMMON_TOKEN_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/
const SECRET_ASSIGNMENT_PATTERN = /\b(?:api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|bearer[_-]?token|token|authorization|cookie|set-cookie|session[_-]?cookie|password|passwd|private[_-]?key|capability[_-]?token|credential|credentials|client[_-]?secret|webhook[_-]?secret|signing[_-]?secret|secret)\s*[:=]\s*[^\s,;]+/i

function normalizeFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isSensitiveDisplayField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName)
  if (SENSITIVE_FIELD_NAMES.has(normalized)) return true
  return (
    normalized.endsWith('apikey') ||
    normalized.endsWith('token') ||
    normalized.endsWith('cookie') ||
    normalized.endsWith('password') ||
    normalized.endsWith('passwd') ||
    normalized.endsWith('privatekey') ||
    normalized.endsWith('capabilitytoken') ||
    normalized.endsWith('credential') ||
    normalized.endsWith('credentials') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('clientsecret') ||
    normalized.endsWith('webhooksecret') ||
    normalized.endsWith('signingsecret')
  )
}

export function containsSensitiveDisplayString(value: string): boolean {
  return (
    BEARER_PATTERN.test(value) ||
    COOKIE_PATTERN.test(value) ||
    PRIVATE_KEY_PATTERN.test(value) ||
    JWT_PATTERN.test(value) ||
    COMMON_TOKEN_PATTERN.test(value) ||
    SECRET_ASSIGNMENT_PATTERN.test(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isViewContractLike(value: unknown): value is ViewContract {
  if (!isRecord(value)) return false
  return typeof value.contract === 'string' && isRecord(value.fields)
}

function sanitizeViewField(
  fieldName: string,
  field: ViewField,
  seen: WeakSet<object>,
): ViewField {
  return {
    ...field,
    value: sanitizeDisplayValue(field.value, fieldName, seen),
    reason:
      typeof field.reason === 'string' && containsSensitiveDisplayString(field.reason)
        ? REDACTED_DISPLAY_VALUE
        : field.reason,
  }
}

function sanitizeViewContract(contract: ViewContract, seen: WeakSet<object>): ViewContract {
  const fields = Object.fromEntries(
    Object.entries(contract.fields).map(([fieldName, field]) => [
      fieldName,
      sanitizeViewField(fieldName, field, seen),
    ]),
  )
  return { ...contract, fields }
}

export function sanitizeDisplayValue(
  value: unknown,
  fieldName: string | null = null,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value
  if (fieldName !== null && isSensitiveDisplayField(fieldName)) {
    return REDACTED_DISPLAY_VALUE
  }
  if (typeof value === 'string') {
    return containsSensitiveDisplayString(value) ? REDACTED_DISPLAY_VALUE : value
  }
  if (typeof value !== 'object') return value

  if (seen.has(value)) return REDACTED_DISPLAY_VALUE
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeDisplayValue(item, null, seen))
    }
    if (isViewContractLike(value)) {
      return sanitizeViewContract(value, seen)
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeDisplayValue(item, key, seen),
      ]),
    )
  } finally {
    seen.delete(value)
  }
}

export function sanitizeOperationsSnapshot(
  snapshot: OperationsSnapshot | null,
): OperationsSnapshot | null {
  if (snapshot === null) return null
  return sanitizeDisplayValue(snapshot) as OperationsSnapshot
}

export function sanitizeDisplayString(value: string | null): string | null {
  if (value === null) return null
  return containsSensitiveDisplayString(value) ? REDACTED_DISPLAY_VALUE : value
}
