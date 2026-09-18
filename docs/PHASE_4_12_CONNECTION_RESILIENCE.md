# Phase 4.12 - Connection resilience

Status: **MOUNTED BROWSER LIVE SESSION + REAL HTTP/SSE RESILIENCE PATH CI-VERIFIED; EXTERNAL PREVIEW DEPLOY REMAINS ON EARLIER RUNTIME COMMIT**

Applies to: Phase 4 read-only Operations Console snapshot + SSE runtime proof.

## Roadmap scope

Frozen Roadmap section 7.12 and the approved Premium Frontend Acceptance amendment require the live UI, before Phase 4 closes, to handle the applicable live path for:

- connection status;
- disconnect;
- reconnect with bounded backoff;
- heartbeat where required by the selected transport/runtime;
- sequence gaps / continuity failure;
- authoritative snapshot resync;
- failed resync;
- stale marking;
- authority unavailable.

Loss of connection or failed resync must never leave retained data visually presented as current authority.

## Current verified implementation

The Phase 4 branch now contains a complete DEVELOPMENT/PREVIEW read-only browser path:

- canonical live-event envelope validation and fail-closed sequence/state-version handling;
- backend `LiveEventProducer`;
- typed `VIEW_CONTRACT_SYSTEM_STATE` live-event family;
- fetch-based SSE framing and browser consumption;
- shared fail-closed Operations read authorization for snapshot + SSE;
- HTTP snapshot endpoint and SSE endpoint through the Operations Read Gateway;
- opaque DEVELOPMENT/PREVIEW bearer authorization, memory-only in the browser;
- strict backend transport -> frontend `OperationsSnapshot` adapter;
- automatic browser reconnect dispatch;
- bounded reconnect scheduling using the existing resilience policy;
- automatic authoritative snapshot fetch before authority is restored;
- explicit sequence-gap -> `RESYNC_REQUIRED` -> snapshot-resync flow;
- failed resync -> `UNAVAILABLE` without promoting retained state;
- mounted `OperationsLiveProvider` in the default application path;
- explicit opt-in DEVELOPMENT/PREVIEW credential UI, gated behind `VITE_ENABLE_OPERATIONS_PREVIEW_SESSION=true` plus `?operationsPreview=read`;
- cleanup/abort on disconnect or provider unmount;
- no browser credential persistence.

The visual-QA fixture path remains separate from the live provider and continues to be labeled as non-authoritative fixture data.

## Connection and snapshot authority model

`frontend/src/connection-resilience.ts` keeps transport state separate from snapshot freshness:

- transport: `UNKNOWN`, `CONNECTING`, `CONNECTED`, `RECONNECT_WAIT`, `UNAVAILABLE`;
- snapshot: `UNKNOWN`, `CURRENT`, `STALE`, `RESYNC_REQUIRED`.

Authority is available only when transport is `CONNECTED` and the snapshot is `CURRENT`.

`OperationsDataProvider` therefore exposes no current authoritative snapshot to domain views while data is stale, resync-required or unavailable. The Active Context Bar falls back to explicit UNKNOWN / UNAVAILABLE semantics instead of retaining stale authority presentation.

## Reconnect and bounded backoff

`frontend/src/operations-live-session.ts` now dispatches the reconnect loop rather than exposing scheduling metadata only.

On stream failure/end requiring reconnect:

1. retained data becomes stale;
2. connection state becomes `RECONNECT_WAIT`;
3. a bounded delay is scheduled;
4. reconnect transitions through `CONNECTING`;
5. a fresh authoritative snapshot is fetched;
6. authority returns only after that snapshot validates and becomes `CURRENT`.

The default resilience policy remains:

- base delay: 1 second;
- maximum delay: 30 seconds.

Deterministic runtime tests inject shorter delays only to keep CI bounded; they do not alter the production/default resilience policy.

## Sequence gaps and snapshot resync

The canonical event evaluator remains the only sequence/state continuity authority.

A missing sequence, collision, stale/out-of-order event or state-version drift cannot be guessed through. `OperationsLiveSession` consumes the evaluator result and requires a fresh snapshot.

The strict snapshot adapter:

- validates serialized backend `ViewContract` field metadata;
- requires `SYSTEM_STATE`;
- rejects duplicate singleton contracts;
- preserves source class, availability and unavailable reason;
- does not infer Leader or active Work Order authority from ambiguous collections;
- currently applies only the typed `VIEW_CONTRACT_SYSTEM_STATE` event family;
- rejects unsupported event families instead of inventing state.

Failed resync preserves fail-closed state and cannot restore authority.

## Browser credential and secret boundary

The DEVELOPMENT/PREVIEW browser credential remains:

- opaque;
- read-only;
- never a provider credential;
- supplied interactively only in explicit preview-session mode;
- held in React/client memory only;
- cleared from the credential input after connect;
- not written to `localStorage`, `sessionStorage`, cookies, URLs, telemetry, audit payloads, generated assets or repository source.

The preview-session input is absent from the ordinary console path unless both the explicit build-time preview flag and query-mode gate are present.

No Writer, approval, execution, deploy, unlock, policy override or other Phase 5 mutation capability is introduced.

## Heartbeat

Application heartbeat is **not currently required by the verified finite Phase 4 DEVELOPMENT/PREVIEW SSE contract**.

The deterministic runtime harness deliberately terminates streams to exercise reconnect/stale/resync behavior. The current deployed Operations Preview also serves finite event reads rather than depending on an application heartbeat to maintain authority.

This is not a production heartbeat decision. If a later long-lived transport, proxy or hosting topology requires heartbeat/liveness frames, that must be introduced from runtime evidence and cannot promote health, verification, approval, write eligibility or authority.

## Controlled runtime evidence

The current browser E2E uses actual HTTP requests and fetch-based SSE through the repository-owned Operations gateway adapter and mounted application provider.

The deterministic sequence proves:

1. unauthenticated snapshot -> 401;
2. authenticated snapshot state-v1 / sequence 0 -> CURRENT;
3. SSE event sequence 1 / state-v2 -> accepted;
4. stream termination -> STALE + `RECONNECT_WAIT`;
5. bounded reconnect dispatch -> CONNECTING;
6. fresh snapshot state-v2 / sequence 1 -> CURRENT;
7. SSE sequence 3 gap -> `RESYNC_REQUIRED`;
8. authoritative snapshot state-v3 / sequence 3 -> CURRENT;
9. subsequent stream termination -> reconnect;
10. snapshot 503 -> UNAVAILABLE + STALE;
11. visible current authority fields fall back to UNKNOWN;
12. browser storage and cookies remain empty.

This path is exercised by `frontend/e2e/operations-runtime.spec.mjs` against `scripts/operations_gateway_e2e_server.py`.

Latest verified implementation baseline before this documentation update:
`da218043e158a8735f8a0f3a54cd9e532c726ebf`

- `control-plane-ci #221`: SUCCESS
- `full-system-validation #143`: SUCCESS
- browser E2E: SUCCESS
- external Operations Preview smoke: SUCCESS

## External Preview runtime evidence

The dedicated Render DEVELOPMENT/PREVIEW service remains independently verified for:

- health;
- denied unauthenticated snapshot;
- authenticated authoritative snapshot;
- canonical SSE delivery;
- read-only mutation rejection.

The external smoke is executed from CI using the GitHub Actions repository secret `ALPHA_OPERATIONS_PREVIEW_TOKEN`. The credential value is never printed.

The currently deployed Render runtime is intentionally not claimed to contain every later frontend/session commit on this branch. Its last independently confirmed deployed application commit remains the earlier preview runtime commit. Auto-deploy is disabled.

## Known limitation retained explicitly

The current real Preview producer emits the authoritative SYSTEM_STATE event once for the runtime instance and remains quiet until a later authoritative state-change source is wired.

There is no verified repository-owned ongoing external authority-change subscription to invent at this phase.

Therefore:

- the real producer + SSE delivery path is confirmed;
- the controlled browser resilience path is confirmed;
- no claim is made that arbitrary future Control Plane changes are already subscribed and streamed continuously;
- unavailable Runtime / Telemetry / Agent data remains unavailable rather than simulated.

## Security and authority invariants

Unchanged:

- backend / Control Plane remains authority;
- `TELEMETRY != AUTHORITY`;
- connection success != current authoritative snapshot;
- reconnect success alone != restored authority;
- heartbeat != health, verification, approval or write eligibility;
- sequence/state drift requires resync;
- stale or resync-required data is not exposed as current authority;
- no Phase 5 write controls;
- no default-allow auth;
- no provider credential reaches the browser.

## Remaining scope

Production identity/authentication is intentionally unresolved and belongs to a later gate.

An ongoing authoritative change subscription may be added only when a real authority-change source exists. It is not fabricated merely to keep an SSE connection busy.

No merge, production deploy, secret change or Phase 5 write capability is authorized by this document.
