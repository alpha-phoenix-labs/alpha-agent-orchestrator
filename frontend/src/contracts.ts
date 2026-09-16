export type SourceClass =
  | 'AUTHORITATIVE'
  | 'WORK_ORDER'
  | 'EVIDENCE'
  | 'RUNTIME'
  | 'TELEMETRY'
  | 'LOCAL_UI'

export type ViewField<T = unknown> = {
  source_class: SourceClass
  available: boolean
  value: T | null
  reason: string | null
}

export type ViewContract = {
  contract: string
  fields: Record<string, ViewField>
}

export type OperationsSnapshot = {
  systemState?: ViewContract
  canonicalState?: ViewContract
}

export function readAvailableField<T>(
  contract: ViewContract | undefined,
  fieldName: string,
): T | null {
  const field = contract?.fields[fieldName]
  if (!field || !field.available) {
    return null
  }
  return field.value as T | null
}
