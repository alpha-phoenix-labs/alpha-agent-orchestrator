import { readAvailableField, readUnavailableReason, type ViewContract } from './contracts'

export type ContractFieldRead = Readonly<{
  value: unknown
  reason?: string
}>

export function readContractField(contract: ViewContract | undefined, field: string): ContractFieldRead {
  return {
    value: readAvailableField<unknown>(contract, field),
    reason: readUnavailableReason(contract, field) ?? undefined,
  }
}

export function formatContractValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function readContractText(
  contract: ViewContract | undefined,
  field: string,
  fallback: string,
): string {
  return formatContractValue(readContractField(contract, field).value, fallback)
}
