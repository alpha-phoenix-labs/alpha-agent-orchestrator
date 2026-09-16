import { createContext, type PropsWithChildren, useContext } from 'react'

import {
  connectionAuthorityAvailable,
  type ConnectionResilienceState,
  type ConnectionStatus,
  type SnapshotStatus,
} from './connection-resilience'
import type { OperationsSnapshot } from './contracts'

type OperationsData = {
  snapshot: OperationsSnapshot | null
  authorityAvailable: boolean
  connectionManaged: boolean
  connectionStatus: ConnectionStatus
  snapshotStatus: SnapshotStatus
}

const OperationsDataContext = createContext<OperationsData>({
  snapshot: null,
  authorityAvailable: false,
  connectionManaged: false,
  connectionStatus: 'UNKNOWN',
  snapshotStatus: 'UNKNOWN',
})

type OperationsDataProviderProps = PropsWithChildren<{
  snapshot?: OperationsSnapshot | null
  resilience?: ConnectionResilienceState | null
}>

export function OperationsDataProvider({
  snapshot = null,
  resilience = null,
  children,
}: OperationsDataProviderProps) {
  const connectionManaged = resilience !== null
  const resilienceAllowsAuthority =
    resilience === null ? true : connectionAuthorityAvailable(resilience)
  const authorityAvailable = snapshot !== null && resilienceAllowsAuthority
  const presentedSnapshot = authorityAvailable ? snapshot : null

  return (
    <OperationsDataContext.Provider
      value={{
        snapshot: presentedSnapshot,
        authorityAvailable,
        connectionManaged,
        connectionStatus: resilience?.connectionStatus ?? 'UNKNOWN',
        snapshotStatus: resilience?.snapshotStatus ?? 'UNKNOWN',
      }}
    >
      {children}
    </OperationsDataContext.Provider>
  )
}

export function useOperationsData(): OperationsData {
  return useContext(OperationsDataContext)
}
