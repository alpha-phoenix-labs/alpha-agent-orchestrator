import {
  applyLiveEventEvaluation,
  createConnectionResilienceState,
  markConnectionConnected,
  markConnectionLost,
  markConnectionUnavailable,
  markReconnectAttempt,
  markSnapshotResynced,
  requireSnapshotResync,
  type ConnectionResilienceState,
  type ReconnectBackoffPolicy,
} from './connection-resilience'
import type { OperationsSnapshot } from './contracts'
import type { LiveEventCursor, LiveEventEvaluation } from './live-events'
import {
  OperationsLiveClient,
  OperationsLiveClientError,
  type OperationsSnapshotTransport,
} from './operations-live-client'
import {
  applySystemStateEventToTransport,
  mapOperationsSnapshotTransport,
  OperationsSnapshotModelError,
} from './operations-snapshot-model'

export type OperationsLiveSessionState = Readonly<{
  transportSnapshot: OperationsSnapshotTransport | null
  snapshot: OperationsSnapshot | null
  cursor: LiveEventCursor | null
  resilience: ConnectionResilienceState
}>

export type OperationsLiveSessionListener = (state: OperationsLiveSessionState) => void

type LiveTransport = Pick<OperationsLiveClient, 'fetchSnapshot' | 'consumeEvents'>

type Delay = (milliseconds: number, signal: AbortSignal) => Promise<void>

function defaultDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const timeout = globalThis.setTimeout(resolve, milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timeout)
        resolve()
      },
      { once: true },
    )
  })
}

export class OperationsLiveSession {
  readonly #client: LiveTransport
  readonly #listener: OperationsLiveSessionListener
  readonly #delay: Delay
  readonly #backoffPolicy?: ReconnectBackoffPolicy
  #state: OperationsLiveSessionState

  constructor({
    client,
    onState,
    delay = defaultDelay,
    backoffPolicy,
  }: {
    client: LiveTransport
    onState: OperationsLiveSessionListener
    delay?: Delay
    backoffPolicy?: ReconnectBackoffPolicy
  }) {
    this.#client = client
    this.#listener = onState
    this.#delay = delay
    this.#backoffPolicy = backoffPolicy
    this.#state = {
      transportSnapshot: null,
      snapshot: null,
      cursor: null,
      resilience: createConnectionResilienceState('NOT_REQUIRED'),
    }
  }

  get state(): OperationsLiveSessionState {
    return this.#state
  }

  #publish(next: OperationsLiveSessionState): void {
    this.#state = next
    this.#listener(next)
  }

  #publishUnavailable(error: unknown): void {
    const reason =
      error instanceof OperationsLiveClientError || error instanceof OperationsSnapshotModelError
        ? error.code
        : 'OPERATIONS_LIVE_SESSION_FAILED'

    this.#publish({
      ...this.#state,
      resilience: markConnectionUnavailable(this.#state.resilience, reason),
    })
  }

  async #readFreshSnapshot(signal: AbortSignal): Promise<boolean> {
    try {
      const read = await this.#client.fetchSnapshot(signal)
      const snapshot = mapOperationsSnapshotTransport(read.snapshot)
      let resilience = markConnectionConnected(this.#state.resilience)
      resilience = markSnapshotResynced(resilience)
      this.#publish({
        transportSnapshot: read.snapshot,
        snapshot,
        cursor: read.cursor,
        resilience,
      })
      return true
    } catch (error) {
      if (signal.aborted) return false
      this.#publishUnavailable(error)
      return false
    }
  }

  #applyEvaluation(evaluation: LiveEventEvaluation): void {
    let resilience = applyLiveEventEvaluation(this.#state.resilience, evaluation)

    if (evaluation.decision === 'ACCEPTED') {
      if (!evaluation.event || !this.#state.transportSnapshot) {
        resilience = requireSnapshotResync(resilience, 'ACCEPTED_EVENT_WITHOUT_SNAPSHOT')
      } else {
        try {
          const transportSnapshot = applySystemStateEventToTransport(
            this.#state.transportSnapshot,
            evaluation.event,
          )
          const snapshot = mapOperationsSnapshotTransport(transportSnapshot)
          this.#publish({
            transportSnapshot,
            snapshot,
            cursor: evaluation.cursor,
            resilience,
          })
          return
        } catch (error) {
          if (!(error instanceof OperationsSnapshotModelError)) throw error
          resilience = requireSnapshotResync(resilience, error.code)
        }
      }
    }

    this.#publish({
      ...this.#state,
      cursor: evaluation.cursor,
      resilience,
    })
  }

  async run(signal: AbortSignal): Promise<void> {
    if (!await this.#readFreshSnapshot(signal)) return

    while (!signal.aborted) {
      const cursor = this.#state.cursor
      if (!cursor) {
        this.#publishUnavailable(new OperationsSnapshotModelError('LIVE_CURSOR_REQUIRED'))
        return
      }

      try {
        const result = await this.#client.consumeEvents(
          cursor,
          (evaluation) => this.#applyEvaluation(evaluation),
          signal,
        )

        if (signal.aborted || result.reason === 'ABORTED') return

        if (
          result.reason === 'RESYNC_REQUIRED' ||
          this.#state.resilience.snapshotStatus === 'RESYNC_REQUIRED'
        ) {
          if (!await this.#readFreshSnapshot(signal)) return
          continue
        }
      } catch (error) {
        if (signal.aborted) return

        const reason =
          error instanceof OperationsLiveClientError
            ? error.code
            : 'OPERATIONS_STREAM_FAILED'
        const resilience = markConnectionLost(
          this.#state.resilience,
          reason,
          this.#backoffPolicy,
        )
        this.#publish({ ...this.#state, resilience })

        const delay = resilience.nextRetryDelayMs
        if (delay === null) {
          this.#publishUnavailable(error)
          return
        }

        await this.#delay(delay, signal)
        if (signal.aborted) return

        this.#publish({
          ...this.#state,
          resilience: markReconnectAttempt(this.#state.resilience),
        })

        if (!await this.#readFreshSnapshot(signal)) return
      }
    }
  }
}
