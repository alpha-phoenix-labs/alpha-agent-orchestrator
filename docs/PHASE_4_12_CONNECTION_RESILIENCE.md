# Phase 4.12 - Connection resilience

Status: **FOUNDATIONAL CLIENT RESILIENCE - LIVE TRANSPORT STILL UNSELECTED**

Baseline: `main@045d598e109a93b29c60ba30a48568e6eae7876f`

## Roadmap scope

Frozen Roadmap section 7.12 requires the live UI, before Phase 4 closes, to handle:

- connection status;
- reconnect;
- bounded backoff;
- heartbeat where required;
- sequence gaps where applicable;
- snapshot resync;
- stale marking;
- authority unavailable.

It also requires that loss of connection never leave stale data visually presented as current.

## Verified current state

At the baseline above:

- Phase 4.11 provides a transport-neutral live-event envelope and fail-closed sequence/state-version validation;
- the frontend still has no selected WebSocket, SSE or other live transport;
- the repository contains no verified backend live-event streaming endpoint or producer;
- `OperationsDataProvider` receives an injected snapshot and previously treated any non-null snapshot as available authority;
- reconnect timers, heartbeat intervals and snapshot-resync network requests cannot be implemented truthfully until an actual transport/endpoint and delivery requirements exist.

Therefore this patch does not invent a WebSocket/SSE endpoint, reconnect network call, heartbeat cadence or snapshot-fetch URL.

## Implemented resilience boundary

`frontend/src/connection-resilience.ts` adds a deterministic client-side state model with separate concepts for:

- transport connection status: `UNKNOWN`, `CONNECTING`, `CONNECTED`, `RECONNECT_WAIT`, `UNAVAILABLE`;
- snapshot status: `UNKNOWN`, `CURRENT`, `STALE`, `RESYNC_REQUIRED`;
- reconnect attempt count and next retry delay;
- heartbeat requirement and last heartbeat metadata;
- explicit reason codes.

Authority is available only when the transport is `CONNECTED` and the snapshot is `CURRENT`.

### Reconnect and bounded backoff

Connection loss moves the state to `RECONNECT_WAIT`, marks retained data `STALE` unless a resync is already required, and computes a bounded exponential delay.

Default scheduling metadata:

- base delay: 1 second;
- maximum delay: 30 seconds.

The helper returns scheduling metadata only. It does not create timers or dispatch network traffic because no transport has been selected.

A reconnect attempt moves the connection state to `CONNECTING`. A successful connection does **not** restore authority by itself: retained data remains `STALE` until an explicit authoritative snapshot resync completes.

### Sequence gaps and snapshot resync

Phase 4.11 `RESYNC_REQUIRED` event evaluations are consumed by the resilience model. A missing sequence, collision, stale/out-of-order event or state-version drift changes snapshot status to `RESYNC_REQUIRED` without promoting or mutating authoritative domain state.

A future transport integration must obtain a new authoritative snapshot and then explicitly mark that resync complete. This patch does not invent the snapshot endpoint.

### Heartbeat

Heartbeat requirement remains `UNKNOWN` unless a future verified transport integration explicitly supplies `REQUIRED` or `NOT_REQUIRED`.

Recording a heartbeat is metadata-only and never changes connection status, snapshot freshness, verification, approval or write eligibility.

## UI fail-closed behavior

`OperationsDataProvider` now accepts an optional resilience state.

When resilience management is supplied, an injected snapshot is exposed to child views only if:

1. a snapshot exists;
2. connection state is `CONNECTED`;
3. snapshot state is `CURRENT`.

If connection is lost, data becomes stale, or snapshot resync is required, the provider exposes `snapshot=null` and `authorityAvailable=false`. Existing domain views therefore render their established `UNKNOWN` / `UNAVAILABLE` paths instead of retained data.

The Active Context Bar adds connection/snapshot state to its existing Authority value only when resilience management is active, for example:

`UNAVAILABLE · RECONNECT_WAIT · STALE`

This avoids introducing a new frontend authority class or localized domain label while making the connection loss persistent and visible.

## Compatibility boundary

When no resilience state is supplied, `OperationsDataProvider` preserves the pre-4.12 injected-snapshot behavior. This is required for the current static/read-only test fixtures and does not claim a live connection exists.

## Security and authority boundaries

The following remain unchanged:

- `TELEMETRY != AUTHORITY`;
- connection state is local transport state, not backend security authority;
- heartbeat != health, verification, approval or write eligibility;
- reconnect success != fresh authoritative data;
- a sequence gap forces resync instead of being guessed through;
- stale or resync-required data is not exposed as current UI authority;
- no Writer, approval, policy, lock, capability, deploy or execution control is added.

## Deferred / blocked on verified transport evidence

Not included in this patch:

- WebSocket, SSE or other transport selection;
- backend streaming endpoint;
- actual reconnect timer/network dispatch;
- heartbeat interval/timeout policy;
- automatic authoritative snapshot fetch;
- transport-specific authentication;
- payload application into `OperationsSnapshot`.

Those operations remain blocked until a real producer/endpoint and delivery constraints are verified. This patch must not be used as evidence that a live stream exists.

## Validation target

Tests must prove:

- connection + current snapshot are both required for authority;
- connection loss immediately marks retained data stale and hides it from UI authority;
- reconnect backoff is bounded;
- reconnect success alone does not restore authority;
- Phase 4.11 sequence gaps require snapshot resync;
- heartbeat metadata cannot promote authority;
- the visible Active Context Bar reports connection loss while canonical fields fall back to `UNKNOWN`.

No Render runtime file, backend read-proxy path, production configuration, secret or write capability is changed by this patch.
