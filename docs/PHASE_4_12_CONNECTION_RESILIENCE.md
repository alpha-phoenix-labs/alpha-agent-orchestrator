# Phase 4.12 - Connection resilience

Status: **FOUNDATIONAL CLIENT RESILIENCE + SSE SELECTED; LIVE ENDPOINT/AUTH/RESYNC PATH NOT YET IMPLEMENTED**

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

Loss of connection must never leave stale data visually presented as current.

## Verified current state

The branch now has:

- the Phase 4.11 canonical live-event envelope and fail-closed sequence/state-version validation;
- a backend `LiveEventProducer`;
- one typed `SYSTEM_STATE` event family;
- SSE selected as the server-to-UI transport family;
- a tested SSE framing helper;
- the existing frontend connection-resilience state model.

The repository still has no verified backend SSE streaming endpoint, browser live connection, transport authentication contract or authoritative snapshot-resync endpoint. Therefore no network reconnect loop, heartbeat cadence or snapshot-fetch URL is invented here.

## Implemented resilience boundary

`frontend/src/connection-resilience.ts` keeps transport connection status separate from snapshot freshness:

- transport: `UNKNOWN`, `CONNECTING`, `CONNECTED`, `RECONNECT_WAIT`, `UNAVAILABLE`;
- snapshot: `UNKNOWN`, `CURRENT`, `STALE`, `RESYNC_REQUIRED`.

It also tracks reconnect attempt metadata, bounded retry delay, heartbeat requirement metadata and explicit reason codes.

Authority is available only when transport is `CONNECTED` and snapshot state is `CURRENT`.

### Reconnect and bounded backoff

Connection loss moves state to `RECONNECT_WAIT`, marks retained data `STALE` unless resync is already required, and computes bounded exponential delay metadata.

Current defaults:

- base delay: 1 second;
- maximum delay: 30 seconds.

These values are scheduling metadata only. No network timer or reconnect request is dispatched yet.

A successful reconnect does not restore authority by itself. Retained data remains stale until an explicit authoritative snapshot resync completes.

### Sequence gaps and snapshot resync

Phase 4.11 `RESYNC_REQUIRED` evaluations are consumed by the resilience model. Missing sequence, collision, stale/out-of-order delivery or state-version drift changes snapshot status to `RESYNC_REQUIRED` without mutating authoritative domain state.

A future SSE integration must obtain a fresh authoritative snapshot before marking resync complete. The required endpoint does not yet exist.

### Heartbeat

Heartbeat requirement remains `UNKNOWN` until the real SSE endpoint and hosting/proxy behavior establish whether an application heartbeat is required.

Heartbeat metadata never changes health, verification, approval, write eligibility or authority.

## UI fail-closed behavior

When resilience management is active, `OperationsDataProvider` exposes a snapshot only when:

1. a snapshot exists;
2. transport is `CONNECTED`;
3. snapshot is `CURRENT`.

Connection loss, stale data or resync requirement causes `snapshot=null` and `authorityAvailable=false`, so existing domain views render explicit `UNKNOWN` / `UNAVAILABLE` states.

## SSE-specific boundary

SSE selection changes only the transport family. It does not yet select:

- native `EventSource` versus a fetch-based SSE reader;
- credential/header strategy;
- same-origin/CORS configuration;
- replay buffer or `Last-Event-ID` behavior;
- heartbeat interval/timeout;
- endpoint URL;
- snapshot-resync URL.

Those decisions require verified runtime/authentication constraints. In particular, the browser API choice must not be made before the authentication boundary is known.

## Verified operations-read ownership investigation

The current repository evidence establishes the following boundary:

- backend view-contract semantics are owned by `src/alpha_orchestrator/view_contracts.py`; it defines the source classes, field availability semantics, `SYSTEM_STATE` and the other backend-owned read contracts, plus `view_payload()` serialization that preserves authority and unavailability metadata;
- the frontend `OperationsSnapshot` in `frontend/src/contracts.ts` is a composition type for those contracts, not a backend authority source;
- the default application mounts `OperationsDataProvider` without a snapshot, so the production/default frontend path does not currently fetch or receive an authoritative operations snapshot;
- the existing `scripts/render_read_proxy_server.py` HTTP surface is limited to `/healthz` and `/v1/render/services` and is not a general Operations API;
- its bearer authentication is specifically the Render read-proxy credential boundary from `src/alpha_orchestrator/render_read_proxy.py`, including Render provider/workspace configuration, and must not be silently repurposed as a generic Operations/SSE authentication contract;
- repository search found no existing general Operations snapshot endpoint or general live-read authentication owner to extend.

Therefore the missing live path is not merely an unimplemented route. A general read-only Operations HTTP/authentication boundary must be explicitly owned and defined before an SSE endpoint or snapshot-resync endpoint can be implemented safely.

### Required contract before endpoint implementation

The next network implementation may proceed only after repository-owned evidence defines one read-only Operations boundary that:

- authenticates browser reads without exposing provider credentials;
- serves a fresh authoritative snapshot derived from backend view contracts;
- streams only typed backend-owned live events over SSE;
- preserves `TELEMETRY != AUTHORITY` and every `available` / `reason` field;
- restores authority only after a successful authoritative snapshot resync;
- exposes no approval, Writer, deploy, unlock, policy override or execution capability;
- does not reuse the Render-specific proxy credential contract unless a separately approved architecture change explicitly makes that boundary general-purpose.

No token name, endpoint URL, CORS policy, credential transport, replay policy or heartbeat cadence is invented by this investigation.

## Security and authority boundaries

The following remain unchanged:

- `TELEMETRY != AUTHORITY`;
- transport state is not backend security authority;
- heartbeat != health, verification, approval or write eligibility;
- reconnect success != fresh authoritative data;
- a sequence gap forces resync instead of being guessed through;
- stale or resync-required data is not exposed as current UI authority;
- no Writer, approval, policy, lock, capability, deploy or execution control is added.

## Deferred / blocked on runtime evidence

Not yet implemented:

- general read-only Operations HTTP/authentication boundary;
- authoritative Operations snapshot endpoint;
- backend SSE endpoint;
- browser SSE connection;
- actual reconnect network dispatch;
- heartbeat interval/timeout policy;
- automatic authoritative snapshot fetch;
- transport authentication;
- replay/`Last-Event-ID` semantics;
- typed payload application into `OperationsSnapshot`.

This document must not be used as evidence that a real live stream exists.

## Validation target

Tests must continue to prove:

- connection + current snapshot are both required for authority;
- connection loss marks retained data stale and hides it from UI authority;
- reconnect backoff is bounded;
- reconnect success alone does not restore authority;
- sequence/state drift requires snapshot resync;
- heartbeat metadata cannot promote authority;
- the visible Active Context Bar reports connection loss while canonical fields fall back to `UNKNOWN`.

The SSE framing layer additionally has to preserve the canonical envelope and reject framing injection.

No Render runtime file, production configuration, secret or write capability is changed by this patch.
