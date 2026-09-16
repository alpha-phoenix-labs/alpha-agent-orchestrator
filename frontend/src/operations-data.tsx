import { createContext, type PropsWithChildren, useContext } from 'react'

import {
  connectionAuthorityAvailable,
  type ConnectionResilienceState,
  type ConnectionStatus,
  type SnapshotStatus,
} from './connection-resilience'
import type { OperationsSnapshot } from './contracts'
import {
  evaluateViewStateContext,
  type ViewContextStatus,
  type ViewMode,
} from './state-drift'

type OperationsData = {
  snapshot: OperationsSnapshot | null
  currentSnapshot: OperationsSnapshot | null
  authorityAvailable: boolean
  currentAuthorityAvailable: boolean
  connectionManaged: boolean
  connectionStatus: ConnectionStatus
  snapshotStatus: SnapshotStatus
  viewContextManaged: boolean
  viewMode: ViewMode
  viewedStateVersion: string | null
  currentStateVersion: string | null
  viewContextStatus: ViewContextStatus
  staleContext: boolean
  viewContextReason: string
  approvalInvalidationAvailable: false
  approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT'
}

const OperationsDataContext = createContext<OperationsData>({
  snapshot: null,
  currentSnapshot: null,
  authorityAvailable: false,
  currentAuthorityAvailable: false,
  connectionManaged: false,
  connectionStatus: 'UNKNOWN',
  snapshotStatus: 'UNKNOWN',
  viewContextManaged: false,
  viewMode: 'LIVE',
  viewedStateVersion: null,
  currentStateVersion: null,
  viewContextStatus: 'UNKNOWN',
  staleContext: false,
  viewContextReason: 'NO_VIEWED_STATE_BINDING',
  approvalInvalidationAvailable: false,
  approvalInvalidationReason: 'NO_APPROVAL_VIEW_CONTRACT',
})

type OperationsDataProviderProps = PropsWithChildren<{
  snapshot?: OperationsSnapshot | null
  resilience?: ConnectionResilienceState | null
  viewMode?: ViewMode
  viewedStateVersion?: string | null
}>

export function OperationsDataProvider({
  snapshot = null,
  resilience = null,
  viewMode = 'LIVE',
  viewedStateVersion = null,
  children,
}: OperationsDataProviderProps) {
  const connectionManaged = resilience !== null
  const resilienceAllowsAuthority =
    resilience === null ? true : connectionAuthorityAvailable(resilience)
  const currentAuthorityAvailable = snapshot !== null && resilienceAllowsAuthority
  const currentSnapshot = currentAuthorityAvailable ? snapshot : null
  const viewState = evaluateViewStateContext({
    currentSnapshot,
    viewedStateVersion,
    mode: viewMode,
  })
  const authorityAvailable =
    currentAuthorityAvailable && viewState.currentSnapshotPermitted
  const presentedSnapshot = authorityAvailable ? currentSnapshot : null

  return (
    <OperationsDataContext.Provider
      value={{
        snapshot: presentedSnapshot,
        currentSnapshot,
        authorityAvailable,
        currentAuthorityAvailable,
        connectionManaged,
        connectionStatus: resilience?.connectionStatus ?? 'UNKNOWN',
        snapshotStatus: resilience?.snapshotStatus ?? 'UNKNOWN',
        viewContextManaged: viewState.managed,
        viewMode: viewState.mode,
        viewedStateVersion: viewState.viewedStateVersion,
        currentStateVersion: viewState.currentStateVersion,
        viewContextStatus: viewState.status,
        staleContext: viewState.staleContext,
        viewContextReason: viewState.reason,
        approvalInvalidationAvailable: viewState.approvalInvalidationAvailable,
        approvalInvalidationReason: viewState.approvalInvalidationReason,
      }}
    >
      {children}
    </OperationsDataContext.Provider>
  )
}

export function useOperationsData(): OperationsData {
  return useContext(OperationsDataContext)
}
