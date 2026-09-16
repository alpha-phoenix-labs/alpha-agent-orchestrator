import type { LiveEventEvaluation } from './live-events'

export type ConnectionStatus =
  | 'UNKNOWN'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECT_WAIT'
  | 'UNAVAILABLE'

export type SnapshotStatus = 'UNKNOWN' | 'CURRENT' | 'STALE' | 'RESYNC_REQUIRED'

export type HeartbeatRequirement = 'UNKNOWN' | 'NOT_REQUIRED' | 'REQUIRED'

export type ReconnectBackoffPolicy = Readonly<{
  baseDelayMs: number
  maxDelayMs: number
}>

export const DEFAULT_RECONNECT_BACKOFF: ReconnectBackoffPolicy = Object.freeze({
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
})

export type ConnectionResilienceState = Readonly<{
  connectionStatus: ConnectionStatus
  snapshotStatus: SnapshotStatus
  retryAttempt: number
  nextRetryDelayMs: number | null
  heartbeatRequirement: HeartbeatRequirement
  lastHeartbeatAt: string | null
  reason: string | null
}>

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isOffsetTimestamp(value: string): boolean {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return false
  }
  return Number.isFinite(Date.parse(value))
}

function validateBackoffPolicy(policy: ReconnectBackoffPolicy): void {
  if (
    !isPositiveInteger(policy.baseDelayMs) ||
    !isPositiveInteger(policy.maxDelayMs) ||
    policy.maxDelayMs < policy.baseDelayMs
  ) {
    throw new Error('INVALID_RECONNECT_BACKOFF_POLICY')
  }
}

export function nextReconnectDelayMs(
  attempt: number,
  policy: ReconnectBackoffPolicy = DEFAULT_RECONNECT_BACKOFF,
): number {
  if (!isPositiveInteger(attempt)) {
    throw new Error('INVALID_RECONNECT_ATTEMPT')
  }
  validateBackoffPolicy(policy)

  const exponent = Math.min(attempt - 1, 30)
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent)
}

export function createConnectionResilienceState(
  heartbeatRequirement: HeartbeatRequirement = 'UNKNOWN',
): ConnectionResilienceState {
  return {
    connectionStatus: 'UNKNOWN',
    snapshotStatus: 'UNKNOWN',
    retryAttempt: 0,
    nextRetryDelayMs: null,
    heartbeatRequirement,
    lastHeartbeatAt: null,
    reason: null,
  }
}

export function connectionAuthorityAvailable(state: ConnectionResilienceState): boolean {
  return state.connectionStatus === 'CONNECTED' && state.snapshotStatus === 'CURRENT'
}

export function markConnectionConnected(
  state: ConnectionResilienceState,
): ConnectionResilienceState {
  return {
    ...state,
    connectionStatus: 'CONNECTED',
    retryAttempt: 0,
    nextRetryDelayMs: null,
    reason: null,
  }
}

export function markSnapshotResynced(
  state: ConnectionResilienceState,
): ConnectionResilienceState {
  if (state.connectionStatus !== 'CONNECTED') {
    throw new Error('CONNECTION_NOT_CONNECTED')
  }

  return {
    ...state,
    snapshotStatus: 'CURRENT',
    reason: null,
  }
}

export function markSnapshotStale(
  state: ConnectionResilienceState,
  reason = 'SNAPSHOT_STALE',
): ConnectionResilienceState {
  return {
    ...state,
    snapshotStatus: 'STALE',
    reason,
  }
}

export function requireSnapshotResync(
  state: ConnectionResilienceState,
  reason = 'SNAPSHOT_RESYNC_REQUIRED',
): ConnectionResilienceState {
  return {
    ...state,
    snapshotStatus: 'RESYNC_REQUIRED',
    reason,
  }
}

export function markConnectionLost(
  state: ConnectionResilienceState,
  reason = 'CONNECTION_LOST',
  policy: ReconnectBackoffPolicy = DEFAULT_RECONNECT_BACKOFF,
): ConnectionResilienceState {
  const retryAttempt = state.retryAttempt + 1
  const snapshotStatus =
    state.snapshotStatus === 'RESYNC_REQUIRED' ? 'RESYNC_REQUIRED' : 'STALE'

  return {
    ...state,
    connectionStatus: 'RECONNECT_WAIT',
    snapshotStatus,
    retryAttempt,
    nextRetryDelayMs: nextReconnectDelayMs(retryAttempt, policy),
    reason,
  }
}

export function markReconnectAttempt(
  state: ConnectionResilienceState,
): ConnectionResilienceState {
  if (state.connectionStatus !== 'RECONNECT_WAIT') {
    throw new Error('RECONNECT_NOT_SCHEDULED')
  }

  return {
    ...state,
    connectionStatus: 'CONNECTING',
    nextRetryDelayMs: null,
    reason: 'RECONNECTING',
  }
}

export function markConnectionUnavailable(
  state: ConnectionResilienceState,
  reason = 'CONNECTION_UNAVAILABLE',
): ConnectionResilienceState {
  return {
    ...state,
    connectionStatus: 'UNAVAILABLE',
    snapshotStatus:
      state.snapshotStatus === 'RESYNC_REQUIRED' ? 'RESYNC_REQUIRED' : 'STALE',
    nextRetryDelayMs: null,
    reason,
  }
}

export function recordHeartbeat(
  state: ConnectionResilienceState,
  observedAt: string,
): ConnectionResilienceState {
  if (!isOffsetTimestamp(observedAt)) {
    throw new Error('INVALID_HEARTBEAT_AT')
  }

  return {
    ...state,
    lastHeartbeatAt: observedAt,
  }
}

export function applyLiveEventEvaluation(
  state: ConnectionResilienceState,
  evaluation: LiveEventEvaluation,
): ConnectionResilienceState {
  if (evaluation.decision !== 'RESYNC_REQUIRED') {
    return state
  }

  return requireSnapshotResync(state, evaluation.reason)
}
