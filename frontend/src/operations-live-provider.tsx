import {
  createContext,
  type FormEvent,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { createConnectionResilienceState, type ConnectionResilienceState } from './connection-resilience'
import { OperationsDataProvider } from './operations-data'
import { OperationsLiveClient, OperationsLiveClientError } from './operations-live-client'
import { OperationsLiveSession } from './operations-live-session'
import type { OperationsSnapshot } from './contracts'

type SessionControl = Readonly<{
  enabled: boolean
  active: boolean
  connectionStatus: ConnectionResilienceState['connectionStatus']
  connect: (credential: string) => string | null
  disconnect: () => void
}>

const SessionControlContext = createContext<SessionControl>({
  enabled: false,
  active: false,
  connectionStatus: 'UNKNOWN',
  connect: () => 'PREVIEW_SESSION_UNAVAILABLE',
  disconnect: () => undefined,
})

type LiveClient = Pick<OperationsLiveClient, 'fetchSnapshot' | 'consumeEvents'>

export function OperationsLiveProvider({
  children,
  clientFactory = (credential) =>
    new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: credential,
    }),
}: PropsWithChildren<{
  clientFactory?: (credential: string) => LiveClient
}>) {
  const [client, setClient] = useState<LiveClient | null>(null)
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null)
  const [resilience, setResilience] = useState<ConnectionResilienceState | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!client) return

    const abort = new AbortController()
    abortRef.current = abort
    setSnapshot(null)
    setResilience(createConnectionResilienceState('NOT_REQUIRED'))

    const session = new OperationsLiveSession({
      client,
      onState: (state) => {
        if (abort.signal.aborted) return
        setSnapshot(state.snapshot)
        setResilience(state.resilience)
      },
    })

    void session.run(abort.signal)

    return () => {
      abort.abort()
      if (abortRef.current === abort) abortRef.current = null
    }
  }, [client])

  const control = useMemo<SessionControl>(
    () => ({
      enabled: true,
      active: client !== null,
      connectionStatus: resilience?.connectionStatus ?? 'UNKNOWN',
      connect: (credential) => {
        try {
          const nextClient = clientFactory(credential)
          setClient(nextClient)
          return null
        } catch (error) {
          if (error instanceof OperationsLiveClientError) return error.code
          return 'PREVIEW_SESSION_CONNECT_FAILED'
        }
      },
      disconnect: () => {
        abortRef.current?.abort()
        abortRef.current = null
        setClient(null)
        setSnapshot(null)
        setResilience(null)
      },
    }),
    [client, clientFactory, resilience?.connectionStatus],
  )

  return (
    <SessionControlContext.Provider value={control}>
      <OperationsDataProvider snapshot={snapshot} resilience={resilience}>
        {children}
      </OperationsDataProvider>
    </SessionControlContext.Provider>
  )
}

function previewReadSessionControlEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_OPERATIONS_PREVIEW_SESSION !== 'true') return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('operationsPreview') === 'read'
}

export function PreviewReadSessionControl() {
  const session = useContext(SessionControlContext)
  const [credential, setCredential] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!session.enabled || (!session.active && !previewReadSessionControlEnabled())) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = credential
    setCredential('')
    const nextError = session.connect(value)
    setError(nextError)
  }

  if (session.active) {
    return (
      <div className="alpha-preview-session-control" role="status" aria-label="Development preview read session">
        <span>DEV READ SESSION</span>
        <strong>{session.connectionStatus}</strong>
        <button type="button" onClick={session.disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <form className="alpha-preview-session-control" onSubmit={submit} aria-label="Development preview read session">
      <label>
        <span>DEV READ TOKEN</span>
        <input
          type="password"
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Development preview read token"
        />
      </label>
      <button type="submit">Connect read session</button>
      {error ? <small role="alert">{error}</small> : null}
    </form>
  )
}
