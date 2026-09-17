import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { OperationsSnapshot, ViewContract, ViewField } from './contracts'
import { OperationsDataProvider, useOperationsData } from './operations-data'
import {
  containsSensitiveDisplayString,
  isSensitiveDisplayField,
  REDACTED_DISPLAY_VALUE,
  sanitizeDisplayValue,
} from './secret-redaction'

afterEach(cleanup)

function field<T>(value: T): ViewField<T> {
  return {
    source_class: 'AUTHORITATIVE',
    available: true,
    value,
    reason: null,
  }
}

function contract(name: string, fields: Record<string, ViewField>): ViewContract {
  return { contract: name, fields }
}

function snapshot(stateVersion = 'state-14'): OperationsSnapshot {
  return {
    systemState: contract('SYSTEM_STATE', {
      mode: field('READ_ONLY'),
      writes_enabled: field(false),
      state_version: field(stateVersion),
    }),
    canonicalState: contract('CANONICAL_STATE', {
      repository: field('alpha-phoenix-labs/alpha-agent-orchestrator'),
      branch: field('Bearer phase4_fake_branch_token_12345678'),
      head_sha: field('0123456789abcdef0123456789abcdef01234567'),
    }),
    telemetry: contract('TELEMETRY', {
      metrics: field({
        tokens_per_second: 42,
        api_key: 'phase4_fake_api_key_12345678',
        nested: {
          authorization: 'Bearer phase4_fake_nested_token_12345678',
          latency_ms: 18,
        },
      }),
      observed_at: field('2026-09-17T05:00:00Z'),
    }),
  }
}

function DataProbe() {
  const data = useOperationsData()
  return (
    <div>
      <pre data-testid="snapshot">{JSON.stringify(data.snapshot)}</pre>
      <pre data-testid="current-snapshot">{JSON.stringify(data.currentSnapshot)}</pre>
      <span data-testid="view-status">{data.viewContextStatus}</span>
      <span data-testid="viewed-version">{data.viewedStateVersion ?? 'NULL'}</span>
      <span data-testid="current-version">{data.currentStateVersion ?? 'NULL'}</span>
    </div>
  )
}

describe('Phase 4.14 secret redaction', () => {
  it('recognizes sensitive field names without hiding non-secret token metrics or capability IDs', () => {
    expect(isSensitiveDisplayField('api_key')).toBe(true)
    expect(isSensitiveDisplayField('Authorization')).toBe(true)
    expect(isSensitiveDisplayField('set-cookie')).toBe(true)
    expect(isSensitiveDisplayField('private_key')).toBe(true)
    expect(isSensitiveDisplayField('capability_token')).toBe(true)
    expect(isSensitiveDisplayField('token')).toBe(true)

    expect(isSensitiveDisplayField('tokens_per_second')).toBe(false)
    expect(isSensitiveDisplayField('capability_id')).toBe(false)
    expect(isSensitiveDisplayField('verification_state')).toBe(false)
  })

  it('recognizes high-confidence secret-bearing string shapes', () => {
    expect(containsSensitiveDisplayString('Bearer phase4_fake_token_12345678')).toBe(true)
    expect(containsSensitiveDisplayString('Cookie: session=phase4_fake_cookie')).toBe(true)
    expect(containsSensitiveDisplayString('api_key=phase4_fake_api_key')).toBe(true)
    expect(
      containsSensitiveDisplayString('-----BEGIN PRIVATE KEY-----\nphase4-fake\n-----END PRIVATE KEY-----'),
    ).toBe(true)
    expect(
      containsSensitiveDisplayString('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwaGFzZTQifQ.fake_signature_12345'),
    ).toBe(true)

    expect(containsSensitiveDisplayString('0123456789abcdef0123456789abcdef01234567')).toBe(false)
  })

  it('redacts nested sensitive values while preserving non-sensitive telemetry', () => {
    const sanitized = sanitizeDisplayValue({
      tokens_per_second: 42,
      api_key: 'phase4_fake_api_key_12345678',
      headers: {
        authorization: 'Bearer phase4_fake_nested_token_12345678',
      },
      latency_ms: 18,
    }) as Record<string, unknown>

    expect(sanitized.tokens_per_second).toBe(42)
    expect(sanitized.api_key).toBe(REDACTED_DISPLAY_VALUE)
    expect(sanitized.latency_ms).toBe(18)
    expect((sanitized.headers as Record<string, unknown>).authorization).toBe(
      REDACTED_DISPLAY_VALUE,
    )
  })

  it('preserves nested ViewContract structure while redacting sensitive field values', () => {
    const nested = contract('TEST', {
      token: field('phase4_fake_raw_token_12345678'),
      capability_id: field('capability-7'),
    })

    const sanitized = sanitizeDisplayValue(nested) as ViewContract

    expect(sanitized.contract).toBe('TEST')
    expect(sanitized.fields.token.available).toBe(true)
    expect(sanitized.fields.token.value).toBe(REDACTED_DISPLAY_VALUE)
    expect(sanitized.fields.capability_id.value).toBe('capability-7')
  })

  it('sanitizes both current and presented snapshots before UI consumers can render them', () => {
    render(
      <OperationsDataProvider snapshot={snapshot()}>
        <DataProbe />
      </OperationsDataProvider>,
    )

    const rendered = document.body.textContent ?? ''
    expect(rendered).not.toContain('phase4_fake_branch_token_12345678')
    expect(rendered).not.toContain('phase4_fake_api_key_12345678')
    expect(rendered).not.toContain('phase4_fake_nested_token_12345678')
    expect(rendered).toContain(REDACTED_DISPLAY_VALUE)
    expect(screen.getByTestId('snapshot')).toHaveTextContent('tokens_per_second')
    expect(screen.getByTestId('snapshot')).toHaveTextContent('42')
    expect(screen.getByTestId('current-snapshot')).toHaveTextContent(REDACTED_DISPLAY_VALUE)
  })

  it('uses the raw state version only for drift evaluation while redacting it from UI context', () => {
    const secretLookingStateVersion = 'Bearer phase4_fake_state_token_12345678'

    render(
      <OperationsDataProvider
        snapshot={snapshot(secretLookingStateVersion)}
        viewedStateVersion={secretLookingStateVersion}
      >
        <DataProbe />
      </OperationsDataProvider>,
    )

    expect(screen.getByTestId('view-status')).toHaveTextContent('CURRENT')
    expect(screen.getByTestId('viewed-version')).toHaveTextContent(REDACTED_DISPLAY_VALUE)
    expect(screen.getByTestId('current-version')).toHaveTextContent(REDACTED_DISPLAY_VALUE)
    expect(document.body.textContent).not.toContain(secretLookingStateVersion)
  })
})
