import { readAvailableField, type OperationsSnapshot } from './contracts'

export type ViewMode = 'LIVE' | 'HISTORICAL'
export type ViewContextStatus = 'UNKNOWN' | 'CURRENT' | 'STALE' | 'HISTORICAL'

export type ViewStateContext = {
  managed: boolean
  mode: ViewMode
  viewedStateVersion: string | null
  currentStateVersion: string | null
  status: ViewContextStatus
  staleContext: boolean
  currentSnapshotPermitted: boolean
  reason: string
  approvalInvalidationAvailable: false
  approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT'
}

function normalizeStateVersion(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function snapshotStateVersion(snapshot: OperationsSnapshot | null): string | null {
  return normalizeStateVersion(
    readAvailableField<string>(snapshot?.systemState, 'state_version'),
  )
}

export function evaluateViewStateContext({
  currentSnapshot,
  viewedStateVersion = null,
  mode = 'LIVE',
}: {
  currentSnapshot: OperationsSnapshot | null
  viewedStateVersion?: string | null
  mode?: ViewMode
}): ViewStateContext {
  const viewedVersion = normalizeStateVersion(viewedStateVersion)
  const currentVersion = snapshotStateVersion(currentSnapshot)

  if (mode === 'HISTORICAL') {
    return {
      managed: true,
      mode,
      viewedStateVersion: viewedVersion,
      currentStateVersion: currentVersion,
      status: 'HISTORICAL',
      staleContext: false,
      currentSnapshotPermitted: false,
      reason: 'HISTORICAL_VIEW_CURRENT_SNAPSHOT_SEPARATED',
      approvalInvalidationAvailable: false,
      approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
    }
  }

  if (viewedVersion === null) {
    return {
      managed: false,
      mode,
      viewedStateVersion: null,
      currentStateVersion: currentVersion,
      status: 'UNKNOWN',
      staleContext: false,
      currentSnapshotPermitted: true,
      reason: 'NO_VIEWED_STATE_BINDING',
      approvalInvalidationAvailable: false,
      approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
    }
  }

  if (currentVersion === null) {
    return {
      managed: true,
      mode,
      viewedStateVersion: viewedVersion,
      currentStateVersion: null,
      status: 'UNKNOWN',
      staleContext: true,
      currentSnapshotPermitted: false,
      reason: 'CURRENT_STATE_VERSION_UNAVAILABLE',
      approvalInvalidationAvailable: false,
      approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
    }
  }

  if (viewedVersion === currentVersion) {
    return {
      managed: true,
      mode,
      viewedStateVersion: viewedVersion,
      currentStateVersion: currentVersion,
      status: 'CURRENT',
      staleContext: false,
      currentSnapshotPermitted: true,
      reason: 'STATE_VERSION_MATCH',
      approvalInvalidationAvailable: false,
      approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
    }
  }

  return {
    managed: true,
    mode,
    viewedStateVersion: viewedVersion,
    currentStateVersion: currentVersion,
    status: 'STALE',
    staleContext: true,
    currentSnapshotPermitted: false,
    reason: 'STATE_VERSION_DRIFT',
    approvalInvalidationAvailable: false,
    approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
  }
}
