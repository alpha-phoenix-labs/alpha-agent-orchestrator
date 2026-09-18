import { expect, test } from '@playwright/test'

const OPERATIONS_DEV_URL = 'http://127.0.0.1:4174'
const PREVIEW_TOKEN = 'phase4-e2e-preview-token'

test('real HTTP/SSE session automatically fails closed through reconnect, gap, resync and unavailable', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Single deterministic runtime scenario is exercised in Chromium.')

  await page.goto(OPERATIONS_DEV_URL)

  const result = await page.evaluate(async (previewToken) => {
    const liveClientModule = await import('/src/operations-live-client.ts')
    const liveSessionModule = await import('/src/operations-live-session.ts')
    const resilienceModule = await import('/src/connection-resilience.ts')

    const { OperationsLiveClient } = liveClientModule
    const { OperationsLiveSession } = liveSessionModule
    const { connectionAuthorityAvailable } = resilienceModule

    const unauthorizedResponse = await fetch('/v1/operations/snapshot', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const unauthorizedBody = await unauthorizedResponse.text()

    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: previewToken,
    })

    const states = []
    const delays = []
    const session = new OperationsLiveSession({
      client,
      backoffPolicy: { baseDelayMs: 5, maxDelayMs: 20 },
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      onState: (state) => {
        states.push({
          connectionStatus: state.resilience.connectionStatus,
          snapshotStatus: state.resilience.snapshotStatus,
          reason: state.resilience.reason,
          authority: connectionAuthorityAvailable(state.resilience),
          sequence: state.transportSnapshot?.event_sequence ?? null,
          stateVersion: state.transportSnapshot?.state_version ?? null,
        })
      },
    })

    await session.run(new AbortController().signal)

    return {
      unauthorized: {
        status: unauthorizedResponse.status,
        body: unauthorizedBody,
      },
      states,
      delays,
      persistence: {
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
        cookie: document.cookie,
      },
    }
  }, PREVIEW_TOKEN)

  expect(result.unauthorized).toEqual({ status: 401, body: '' })
  expect(result.delays).toEqual([5, 5])

  expect(result.states).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        connectionStatus: 'CONNECTED',
        snapshotStatus: 'CURRENT',
        authority: true,
        sequence: 0,
        stateVersion: 'state-v1',
      }),
      expect.objectContaining({
        connectionStatus: 'CONNECTED',
        snapshotStatus: 'CURRENT',
        authority: true,
        sequence: 1,
        stateVersion: 'state-v2',
      }),
      expect.objectContaining({
        connectionStatus: 'RECONNECT_WAIT',
        snapshotStatus: 'STALE',
        authority: false,
      }),
      expect.objectContaining({
        connectionStatus: 'CONNECTING',
        snapshotStatus: 'STALE',
        authority: false,
      }),
      expect.objectContaining({
        connectionStatus: 'CONNECTED',
        snapshotStatus: 'RESYNC_REQUIRED',
        authority: false,
        reason: 'MISSING_SEQUENCE',
      }),
      expect.objectContaining({
        connectionStatus: 'CONNECTED',
        snapshotStatus: 'CURRENT',
        authority: true,
        sequence: 3,
        stateVersion: 'state-v3',
      }),
      expect.objectContaining({
        connectionStatus: 'UNAVAILABLE',
        snapshotStatus: 'STALE',
        authority: false,
        reason: 'SNAPSHOT_HTTP_ERROR',
      }),
    ]),
  )

  expect(result.persistence).toEqual({
    localStorage: 0,
    sessionStorage: 0,
    cookie: '',
  })
})
