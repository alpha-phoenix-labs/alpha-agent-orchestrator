import { createContext, type PropsWithChildren, useContext } from 'react'

import type { OperationsSnapshot } from './contracts'

type OperationsData = {
  snapshot: OperationsSnapshot | null
  authorityAvailable: boolean
}

const OperationsDataContext = createContext<OperationsData>({
  snapshot: null,
  authorityAvailable: false,
})

type OperationsDataProviderProps = PropsWithChildren<{
  snapshot?: OperationsSnapshot | null
}>

export function OperationsDataProvider({
  snapshot = null,
  children,
}: OperationsDataProviderProps) {
  return (
    <OperationsDataContext.Provider
      value={{ snapshot, authorityAvailable: snapshot !== null }}
    >
      {children}
    </OperationsDataContext.Provider>
  )
}

export function useOperationsData(): OperationsData {
  return useContext(OperationsDataContext)
}
