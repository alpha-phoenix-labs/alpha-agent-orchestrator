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
  activeWorkOrder?: ViewContract
  workOrders?: readonly ViewContract[]
  lifecycle?: ViewContract
  findings?: readonly ViewContract[]
  evidence?: readonly ViewContract[]
  plan?: ViewContract
  audit?: readonly ViewContract[]
  gates?: readonly ViewContract[]
  locks?: readonly ViewContract[]
  writer?: ViewContract
  leader?: ViewContract
  agents?: readonly ViewContract[]
  connectors?: readonly ViewContract[]
  runtime?: ViewContract
  telemetry?: ViewContract
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

export function readUnavailableReason(
  contract: ViewContract | undefined,
  fieldName: string,
): string | null {
  const field = contract?.fields[fieldName]
  if (!field || field.available) {
    return null
  }
  return field.reason
}
