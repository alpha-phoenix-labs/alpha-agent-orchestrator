import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SourceClass, ViewContract, ViewField } from './contracts'
import type { Phase5ApprovalBinding, Phase5ControlState } from './phase5-control-client'
import { Phase5SandboxControlPanel } from './phase5-control'

afterEach(cleanup)

function known(source_class: SourceClass, value: unknown): ViewField {
  return { source_class, available: true, value, reason: null }
}

function unknown(source_class: SourceClass, reason: string): ViewField {
  return { source_class, available: false, value: null, reason }
}

function view(contract: string, fields: Record<string, ViewField>): ViewContract {
  return { contract, fields }
}

const binding: Phase5ApprovalBinding = {
  order_id: 'WO-PHASE5-UI-001',
  action: 'git_commit',
  target: 'sandbox-git://phase5-ui-proof',
  base_sha: 'a'.repeat(40),
  base_state_version: 'state-phase5',
  plan_hash: 'b'.repeat(64),
  risk: 'HIGH',
}

function pendingState(): Phase5ControlState {
  return {
    schemaVersion: 1,
    orderId: binding.order_id,
    contracts: [
      view('APPROVAL', {
        approval_id: unknown('AUTHORITATIVE', 'APPROVAL_ID_NOT_ISSUED'),
        order_id: known('AUTHORITATIVE', binding.order_id),
        action: known('AUTHORITATIVE', binding.action),
        target: known('AUTHORITATIVE', binding.target),
        base_sha: known('AUTHORITATIVE', binding.base_sha),
        base_state_version: known('AUTHORITATIVE', binding.base_state_version),
        plan_hash: known('AUTHORITATIVE', binding.plan_hash),
        risk: known('AUTHORITATIVE', binding.risk),
        expires_at: unknown('AUTHORITATIVE', 'APPROVAL_NOT_YET_GRANTED'),
        state: known('AUTHORITATIVE', 'PENDING'),
      }),
    ],
  }
}

function approvedState(): Phase5ControlState {
  return {
    schemaVersion: 1,
    orderId: binding.order_id,
    contracts: [
      view('APPROVAL', {
        approval_id: known('AUTHORITATIVE', 'APR-123'),
        order_id: known('AUTHORITATIVE', binding.order_id),
        action: known('AUTHORITATIVE', binding.action),
        target: known('AUTHORITATIVE', binding.target),
        base_sha: known('AUTHORITATIVE', binding.base_sha),
        base_state_version: known('AUTHORITATIVE', binding.base_state_version),
        plan_hash: known('AUTHORITATIVE', binding.plan_hash),
        risk: known('AUTHORITATIVE', binding.risk),
        expires_at: known('AUTHORITATIVE', '2026-09-18T12:00:00+00:00'),
        state: known('AUTHORITATIVE', 'APPROVED'),
      }),
    ],
  }
}

function completedState(): Phase5ControlState {
  return {
    schemaVersion: 1,
    orderId: binding.order_id,
    contracts: [
      ...approvedState().contracts,
      view('CAPABILITY', {
        capability_id: known('AUTHORITATIVE', 'CAP-123'),
        order_id: known('AUTHORITATIVE', binding.order_id),
        scope: known('AUTHORITATIVE', 'git_commit'),
        target: known('AUTHORITATIVE', binding.target),
        expires_at: known('AUTHORITATIVE', '2026-09-18T12:00:00+00:00'),
        consumed_state: known('AUTHORITATIVE', 'CONSUMED'),
      }),
      view('EXECUTION', {
        execution_id: known('AUTHORITATIVE', 'EX-123'),
        order_id: known('AUTHORITATIVE', binding.order_id),
        state: known('AUTHORITATIVE', 'COMPLETED'),
        detail: known('AUTHORITATIVE', 'SANDBOX_EXECUTION_OK'),
      }),
      view('POST_VERIFY', {
        order_id: known('AUTHORITATIVE', binding.order_id),
        state: known('AUTHORITATIVE', 'PASSED'),
        reason: known('AUTHORITATIVE', 'POST_VERIFY_PASS'),
        observed_sha: known('AUTHORITATIVE', 'c'.repeat(40)),
        artifact_digest: known('AUTHORITATIVE', 'd'.repeat(64)),
      }),
    ],
  }
}

describe('Phase 5 Human-Gated sandbox control', () => {
  it('renders no write controls when the feature is disabled', () => {
    render(<Phase5SandboxControlPanel enabled={false} />)
    expect(screen.queryByRole('region', { name: /Phase 5/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('requires exact approval and execution phrases and only renders backend-returned state', async () => {
    const user = userEvent.setup()
    const fetchState = vi.fn().mockResolvedValue(pendingState())
    const approve = vi.fn().mockResolvedValue(approvedState())
    const execute = vi.fn().mockResolvedValue(completedState())
    const clientFactory = vi.fn(() => ({ fetchState, approve, execute }))

    render(<Phase5SandboxControlPanel enabled clientFactory={clientFactory} />)

    await user.type(screen.getByLabelText('Development sandbox control token'), 'secret-token')
    await user.click(screen.getByRole('button', { name: 'Connect sandbox control' }))

    await waitFor(() => expect(fetchState).toHaveBeenCalledTimes(1))
    expect(screen.getByText('PENDING')).toBeInTheDocument()
    expect(screen.getByText('APPROVAL_ID_NOT_ISSUED')).toBeInTheDocument()

    const approveButton = screen.getByRole('button', {
      name: `Approve exact Work Order · ${binding.order_id}`,
    })
    expect(approveButton).toBeDisabled()

    const approvalInput = screen.getByLabelText(`Type exactly: APPROVE ${binding.order_id}`)
    await user.type(approvalInput, 'YES')
    expect(approveButton).toBeDisabled()
    await user.clear(approvalInput)
    await user.type(approvalInput, `APPROVE ${binding.order_id}`)
    expect(approveButton).toBeEnabled()

    await user.click(approveButton)
    await waitFor(() => expect(approve).toHaveBeenCalledWith(binding))
    expect(screen.getByText('APPROVED')).toBeInTheDocument()
    expect(screen.getByText('APR-123')).toBeInTheDocument()

    const executeButton = screen.getByRole('button', {
      name: `Execute approved sandbox write · ${binding.order_id}`,
    })
    expect(executeButton).toBeDisabled()

    const executionInput = screen.getByLabelText(`Type exactly: EXECUTE ${binding.order_id}`)
    await user.type(executionInput, `EXECUTE ${binding.order_id}`)
    expect(executeButton).toBeEnabled()

    await user.click(executeButton)
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        orderId: binding.order_id,
        approvalId: 'APR-123',
      }),
    )

    expect(screen.getByText('CAP-123')).toBeInTheDocument()
    expect(screen.getByText('CONSUMED')).toBeInTheDocument()
    expect(screen.getByText('EX-123')).toBeInTheDocument()
    expect(screen.getByText('POST_VERIFY_PASS')).toBeInTheDocument()
    expect(screen.getByText('PASSED')).toBeInTheDocument()
  })
})
