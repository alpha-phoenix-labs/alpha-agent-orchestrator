import type { OperationsSnapshot, SourceClass, ViewContract, ViewField } from './contracts'
import type { LiveEventEnvelope } from './live-events'
import type { OperationsSnapshotTransport } from './operations-live-client'

const SOURCE_CLASSES = new Set<SourceClass>([
  'AUTHORITATIVE',
  'WORK_ORDER',
  'EVIDENCE',
  'RUNTIME',
  'TELEMETRY',
  'LOCAL_UI',
])

const SINGLETON_CONTRACTS = new Set([
  'SYSTEM_STATE',
  'CANONICAL_STATE',
  'LIFECYCLE',
  'PLAN',
  'WRITER',
  'RUNTIME',
  'TELEMETRY',
])

export class OperationsSnapshotModelError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'OperationsSnapshotModelError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseField(value: unknown, contract: string, fieldName: string): ViewField {
  if (!isRecord(value)) {
    throw new OperationsSnapshotModelError(`INVALID_VIEW_FIELD:${contract}:${fieldName}`)
  }

  const sourceClass = value.source_class
  const available = value.available
  const reason = value.reason

  if (typeof sourceClass !== 'string' || !SOURCE_CLASSES.has(sourceClass as SourceClass)) {
    throw new OperationsSnapshotModelError(`INVALID_SOURCE_CLASS:${contract}:${fieldName}`)
  }
  if (typeof available !== 'boolean') {
    throw new OperationsSnapshotModelError(`INVALID_AVAILABILITY:${contract}:${fieldName}`)
  }
  if (reason !== null && typeof reason !== 'string') {
    throw new OperationsSnapshotModelError(`INVALID_REASON:${contract}:${fieldName}`)
  }
  if (available) {
    if (reason !== null) {
      throw new OperationsSnapshotModelError(`AVAILABLE_FIELD_HAS_REASON:${contract}:${fieldName}`)
    }
  } else {
    if (value.value !== null || typeof reason !== 'string' || reason.length === 0) {
      throw new OperationsSnapshotModelError(`INVALID_UNAVAILABLE_FIELD:${contract}:${fieldName}`)
    }
  }

  return {
    source_class: sourceClass as SourceClass,
    available,
    value: value.value ?? null,
    reason: reason as string | null,
  }
}

export function parseViewContract(value: unknown): ViewContract {
  if (!isRecord(value) || typeof value.contract !== 'string' || !isRecord(value.fields)) {
    throw new OperationsSnapshotModelError('INVALID_VIEW_CONTRACT')
  }

  const fields: Record<string, ViewField> = {}
  for (const [name, field] of Object.entries(value.fields)) {
    fields[name] = parseField(field, value.contract, name)
  }

  return {
    contract: value.contract,
    fields,
  }
}

function push(
  target: Record<string, ViewContract[]>,
  contract: ViewContract,
): void {
  const list = target[contract.contract] ?? []
  list.push(contract)
  target[contract.contract] = list
}

function singleton(
  grouped: Record<string, ViewContract[]>,
  name: string,
): ViewContract | undefined {
  const values = grouped[name] ?? []
  if (values.length > 1) {
    throw new OperationsSnapshotModelError(`DUPLICATE_SINGLETON_CONTRACT:${name}`)
  }
  return values[0]
}

export function mapOperationsSnapshotTransport(
  transport: OperationsSnapshotTransport,
): OperationsSnapshot {
  const grouped: Record<string, ViewContract[]> = {}
  for (const value of transport.contracts) {
    const contract = parseViewContract(value)
    push(grouped, contract)
  }

  for (const name of SINGLETON_CONTRACTS) {
    singleton(grouped, name)
  }

  const systemState = singleton(grouped, 'SYSTEM_STATE')
  if (!systemState) {
    throw new OperationsSnapshotModelError('SYSTEM_STATE_REQUIRED')
  }

  const model: OperationsSnapshot = {
    systemState,
    canonicalState: singleton(grouped, 'CANONICAL_STATE'),
    lifecycle: singleton(grouped, 'LIFECYCLE'),
    plan: singleton(grouped, 'PLAN'),
    writer: singleton(grouped, 'WRITER'),
    runtime: singleton(grouped, 'RUNTIME'),
    telemetry: singleton(grouped, 'TELEMETRY'),
  }

  if (grouped.WORK_ORDER) model.workOrders = grouped.WORK_ORDER
  if (grouped.FINDING) model.findings = grouped.FINDING
  if (grouped.EVIDENCE) model.evidence = grouped.EVIDENCE
  if (grouped.AUDIT) model.audit = grouped.AUDIT
  if (grouped.GATE) model.gates = grouped.GATE
  if (grouped.LOCK) model.locks = grouped.LOCK
  if (grouped.AGENT) model.agents = grouped.AGENT
  if (grouped.CONNECTOR) model.connectors = grouped.CONNECTOR

  return model
}

function systemStateField(value: unknown): ViewField {
  return {
    source_class: 'AUTHORITATIVE',
    available: true,
    value,
    reason: null,
  }
}

export function applySystemStateEventToTransport(
  transport: OperationsSnapshotTransport,
  event: LiveEventEnvelope,
): OperationsSnapshotTransport {
  if (
    event.event_type !== 'VIEW_CONTRACT_SYSTEM_STATE' ||
    event.payload.contract !== 'SYSTEM_STATE' ||
    event.payload.source_class !== 'AUTHORITATIVE' ||
    typeof event.payload.mode !== 'string' ||
    typeof event.payload.writes_enabled !== 'boolean' ||
    event.payload.state_version !== event.state_version
  ) {
    throw new OperationsSnapshotModelError('UNSUPPORTED_LIVE_EVENT_FOR_SNAPSHOT')
  }

  let matches = 0
  const contracts = transport.contracts.map((value) => {
    const contract = parseViewContract(value)
    if (contract.contract !== 'SYSTEM_STATE') return value
    matches += 1

    return {
      contract: 'SYSTEM_STATE',
      fields: {
        ...contract.fields,
        mode: systemStateField(event.payload.mode),
        writes_enabled: systemStateField(event.payload.writes_enabled),
        state_version: systemStateField(event.state_version),
      },
    }
  })

  if (matches !== 1) {
    throw new OperationsSnapshotModelError('SYSTEM_STATE_COUNT_INVALID')
  }

  return {
    schema_version: transport.schema_version,
    state_version: event.state_version,
    event_sequence: event.sequence,
    contracts,
  }
}
