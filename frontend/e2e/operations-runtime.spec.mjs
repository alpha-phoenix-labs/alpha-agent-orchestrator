import { expect, test } from '@playwright/test'

const OPERATIONS_DEV_URL = 'http://127.0.0.1:4174'
const PREVIEW_TOKEN = 'phase4-e2e-preview-token'

test('real HTTP/SSE path fails closed through disconnect, gap, resync and unavailable', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Single deterministic runtime scenario is exercised in Chromium.')

  await page.goto(OPERATIONS_DEV_URL)

  const result = await page.evaluate(async (previewToken) => {
    const liveClientModule = await import('/src/operations-live-client.ts')
    const resilienceModule = await import('/src/connection-resilience.ts')

    const {
      OperationsLiveClient,
      OperationsLiveClientError,
    } = liveClientModule
    const {
      applyLiveEventEvaluation,
      connectionAuthorityAvailable,
      createConnectionResilienceState,
      markConnectionConnected,
      markConnectionLost,
      markConnectionUnavailable,
      markReconnectAttempt,
      markSnapshotResynced,
    } = resilienceModule

    const unauthorizedResponse = await fetch('/v1/operations/snapshot', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const unauthorizedBody = await unauthorizedResponse.text()

    const client = new OperationsLiveClient({
      baseUrl: '',
      bearerCredential: previewToken,
    })

    let resilience = createConnectionResilienceState('NOT_REQUIRED')
    const firstSnapshot = await client.fetchSnapshot()
    resilience = markConnectionConnected(resilience)
    resilience = markSnapshotResynced(resilience)
    let cursor = firstSnapshot.cursor

    const firstEvaluations = []
    let firstStreamError = null
    try {
      await client.consumeEvents(cursor, (evaluation) => {
        firstEvaluations.push({
          decision: evaluation.decision,
          reason: evaluation.reason,
          sequence: evaluation.cursor.lastSequence,
          stateVersion: evaluation.cursor.currentStateVersion,
        })
        if (evaluation.decision === 'ACCEPTED') {
          cursor = evaluation.cursor
        }
      })
    } catch (error) {
      if (!(error instanceof OperationsLiveClientError)) throw error
      firstStreamError = { code: error.code, status: error.status }
      resilience = markConnectionLost(resilience, error.code)
    }

    const afterDisconnect = {
      connectionStatus: resilience.connectionStatus,
      snapshotStatus: resilience.snapshotStatus,
      authority: connectionAuthorityAvailable(resilience),
      cursorSequence: cursor.lastSequence,
      cursorStateVersion: cursor.currentStateVersion,
    }

    resilience = markReconnectAttempt(resilience)
    const secondSnapshot = await client.fetchSnapshot()
    resilience = markConnectionConnected(resilience)
    resilience = markSnapshotResynced(resilience)
    cursor = secondSnapshot.cursor

    const gapEvaluations = []
    const gapResult = await client.consumeEvents(cursor, (evaluation) => {
      gapEvaluations.push({
        decision: evaluation.decision,
        reason: evaluation.reason,
        sequence: evaluation.cursor.lastSequence,
        stateVersion: evaluation.cursor.currentStateVersion,
      })
      resilience = applyLiveEventEvaluation(resilience, evaluation)
    })

    const afterGap = {
      connectionStatus: resilience.connectionStatus,
      snapshotStatus: resilience.snapshotStatus,
      authority: connectionAuthorityAvailable(resilience),
      resultReason: gapResult.reason,
      cursorSequence: gapResult.cursor.lastSequence,
      cursorStateVersion: gapResult.cursor.currentStateVersion,
    }

    const thirdSnapshot = await client.fetchSnapshot()
    resilience = markSnapshotResynced(resilience)
    cursor = thirdSnapshot.cursor

    const afterResync = {
      connectionStatus: resilience.connectionStatus,
      snapshotStatus: resilience.snapshotStatus,
      authority: connectionAuthorityAvailable(resilience),
      cursorSequence: cursor.lastSequence,
      cursorStateVersion: cursor.currentStateVersion,
    }

    let unavailableError = null
    try {
      await client.fetchSnapshot()
    } catch (error) {
      if (!(error instanceof OperationsLiveClientError)) throw error
      unavailableError = { code: error.code, status: error.status }
      resilience = markConnectionUnavailable(resilience, error.code)
    }

    const afterUnavailable = {
      connectionStatus: resilience.connectionStatus,
      snapshotStatus: resilience.snapshotStatus,
      authority: connectionAuthorityAvailable(resilience),
    }

    return {
      unauthorized: {
        status: unauthorizedResponse.status,
        body: unauthorizedBody,
      },
      firstSnapshot: {
        sequence: firstSnapshot.snapshot.event_sequence,
        stateVersion: firstSnapshot.snapshot.state_version,
      },
      firstEvaluations,
      firstStreamError,
      afterDisconnect,
      secondSnapshot: {
        sequence: secondSnapshot.snapshot.event_sequence,
        stateVersion: secondSnapshot.snapshot.state_version,
      },
      gapEvaluations,
      afterGap,
      thirdSnapshot: {
        sequence: thirdSnapshot.snapshot.event_sequence,
        stateVersion: thirdSnapshot.snapshot.state_version,
      },
      afterResync,
      unavailableError,
      afterUnavailable,
      persistence: {
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
        cookie: document.cookie,
      },
    }
  }, PREVIEW_TOKEN)

  expect(result.unauthorized).toEqual({ status: 401, body: '' })
  expect(result.firstSnapshot).toEqual({ sequence: 0, stateVersion: 'state-v1' })
  expect(result.firstEvaluations).toEqual([
    {
      decision: 'ACCEPTED',
      reason: 'ACCEPTED',
      sequence: 1,
      stateVersion: 'state-v2',
    },
  ])
  expect(result.firstStreamError).toEqual({ code: 'SSE_STREAM_ENDED', status: null })
  expect(result.afterDisconnect).toEqual({
    connectionStatus: 'RECONNECT_WAIT',
    snapshotStatus: 'STALE',
    authority: false,
    cursorSequence: 1,
    cursorStateVersion: 'state-v2',
  })

  expect(result.secondSnapshot).toEqual({ sequence: 1, stateVersion: 'state-v2' })
  expect(result.gapEvaluations).toEqual([
    {
      decision: 'RESYNC_REQUIRED',
      reason: 'MISSING_SEQUENCE',
      sequence: 1,
      stateVersion: 'state-v2',
    },
  ])
  expect(result.afterGap).toEqual({
    connectionStatus: 'CONNECTED',
    snapshotStatus: 'RESYNC_REQUIRED',
    authority: false,
    resultReason: 'RESYNC_REQUIRED',
    cursorSequence: 1,
    cursorStateVersion: 'state-v2',
  })

  expect(result.thirdSnapshot).toEqual({ sequence: 3, stateVersion: 'state-v3' })
  expect(result.afterResync).toEqual({
    connectionStatus: 'CONNECTED',
    snapshotStatus: 'CURRENT',
    authority: true,
    cursorSequence: 3,
    cursorStateVersion: 'state-v3',
  })

  expect(result.unavailableError).toEqual({ code: 'SNAPSHOT_HTTP_ERROR', status: 503 })
  expect(result.afterUnavailable).toEqual({
    connectionStatus: 'UNAVAILABLE',
    snapshotStatus: 'STALE',
    authority: false,
  })
  expect(result.persistence).toEqual({
    localStorage: 0,
    sessionStorage: 0,
    cookie: '',
  })
})
