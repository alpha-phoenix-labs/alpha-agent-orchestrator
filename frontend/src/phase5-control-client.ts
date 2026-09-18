import { parseViewContract } from './operations-snapshot-model'
import type { ViewContract } from './contracts'

export type Phase5ControlState = {
  schemaVersion: number
  orderId: string
  contracts: readonly ViewContract[]
}

export type Phase5ApprovalBinding = {
  order_id: string
  action: string
  target: string
  base_sha: string
  base_state_version: string
  plan_hash: string
  risk: string
}

export class Phase5ControlClientError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null = null) {
    super(code)
    this.name = 'Phase5ControlClientError'
    this.code = code
    this.status = status
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseState(value: unknown): Phase5ControlState {
  if (
    !record(value) ||
    value.schema_version !== 1 ||
    typeof value.order_id !== 'string' ||
    !Array.isArray(value.contracts)
  ) {
    throw new Phase5ControlClientError('INVALID_PHASE5_CONTROL_STATE')
  }

  return {
    schemaVersion: value.schema_version,
    orderId: value.order_id,
    contracts: value.contracts.map(parseViewContract),
  }
}

export class Phase5ControlClient {
  private readonly baseUrl: string
  private readonly bearerCredential: string

  constructor({
    baseUrl = '',
    bearerCredential,
  }: {
    baseUrl?: string
    bearerCredential: string
  }) {
    if (
      !bearerCredential ||
      bearerCredential.includes('\r') ||
      bearerCredential.includes('\n')
    ) {
      throw new Phase5ControlClientError('INVALID_PHASE5_CONTROL_CREDENTIAL')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.bearerCredential = bearerCredential
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<Phase5ControlState> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.bearerCredential}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      })
    } catch {
      throw new Phase5ControlClientError('PHASE5_CONTROL_NETWORK_FAILED')
    }

    if (!response.ok) {
      let code = 'PHASE5_CONTROL_REQUEST_REJECTED'
      try {
        const payload = await response.json()
        if (record(payload) && typeof payload.error === 'string') code = payload.error
      } catch {
        // Keep the generic fail-closed code.
      }
      throw new Phase5ControlClientError(code, response.status)
    }

    try {
      return parseState(await response.json())
    } catch (error) {
      if (error instanceof Phase5ControlClientError) throw error
      throw new Phase5ControlClientError('INVALID_PHASE5_CONTROL_STATE')
    }
  }

  fetchState(): Promise<Phase5ControlState> {
    return this.request('/v1/sandbox-control/state', { method: 'GET' })
  }

  approve(binding: Phase5ApprovalBinding): Promise<Phase5ControlState> {
    return this.request('/v1/sandbox-control/approve', {
      method: 'POST',
      body: JSON.stringify({
        ...binding,
        confirmation: `APPROVE ${binding.order_id}`,
      }),
    })
  }

  execute({
    orderId,
    approvalId,
  }: {
    orderId: string
    approvalId: string
  }): Promise<Phase5ControlState> {
    return this.request('/v1/sandbox-control/execute', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        approval_id: approvalId,
        confirmation: `EXECUTE ${orderId}`,
      }),
    })
  }
}
