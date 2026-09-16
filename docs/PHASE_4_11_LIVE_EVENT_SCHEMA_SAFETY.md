# Phase 4.11 - Live event ingestion and schema safety

Status: **FOUNDATIONAL PATCH - TRANSPORT NOT SELECTED**

Baseline: `main@a65ffbbb1be5557b1810ca140d715b911e26b286`

## Scope

This patch implements the smallest transport-neutral Phase 4.11 safety boundary required before any live event stream may mutate Operations Console state.

The frozen roadmap requires live event design to provide enough identity/versioning to detect duplicate events, missing sequence, stale/out-of-order delivery, state-version drift and snapshot/resync requirements. It also requires explicit schema validation and guarantees that invalid or schema-incompatible events do not mutate authoritative UI state.

## Verified current state

At the baseline above:

- the frontend has no `WebSocket`, `EventSource` or SSE integration;
- `OperationsDataProvider` receives a snapshot as an injected value and does not own a live transport;
- the backend `AuditEvent` in `src/alpha_orchestrator/events.py` is append-only Audit state and is not a live UI event contract;
- no backend live-event endpoint or payload mutation contract exists in the repository.

Therefore this patch does **not** select WebSocket, SSE or another transport. Selecting a transport without a real producer/endpoint and verified delivery requirements would invent runtime behavior.

## Canonical transport-neutral envelope

The backend-owned schema in `src/alpha_orchestrator/live_events.py` defines these exact fields:

- `schema_version`
- `event_id`
- `sequence`
- `base_state_version`
- `state_version`
- `emitted_at`
- `event_type`
- `payload`

Schema version `1` is the only accepted version in this patch.

The frontend mirrors this envelope in `frontend/src/live-events.ts` for client-side validation. The frontend mirror does not redefine authority; it validates input before any future typed payload handler can act on it.

## Safety decisions

The ingestion gate returns one of:

- `ACCEPTED` - envelope and continuity checks passed;
- `DUPLICATE` - an already-seen event identity is ignored;
- `RESYNC_REQUIRED` - sequence/state continuity is unsafe and a new authoritative baseline is required;
- `INVALID` - schema or value validation failed.

The following conditions fail closed without advancing the cursor:

- missing or extra envelope fields;
- unsupported schema version;
- invalid event identity;
- invalid sequence or state versions;
- state version earlier than its declared base;
- timestamp without an explicit timezone offset;
- invalid event type;
- non-object payload;
- sequence collision;
- stale/out-of-order sequence;
- missing sequence gap;
- base-state mismatch / state-version drift.

A valid event advances only the event cursor metadata. This patch intentionally does **not** apply `payload` to `OperationsSnapshot` or any other authoritative UI model because no backend payload mutation contract exists yet.

`ACCEPTED` therefore means only that the envelope is structurally and sequentially safe for a later explicitly typed handler. It does not mean verified, approved, write-eligible or authoritative by itself.

## Authority boundaries

The following remain mandatory:

- `TELEMETRY != AUTHORITY`;
- live event delivery != Audit authority;
- animation/activity != verification;
- localized display text != domain state;
- client-side validation never grants write eligibility;
- malformed or incompatible events never mutate authoritative UI state.

Audit and live-event concepts remain separate. `AuditEvent` is not reused as the transport envelope.

## Deferred to later work

Not included in this patch:

- WebSocket/SSE/other transport selection;
- backend streaming endpoint;
- typed payload application into `OperationsSnapshot`;
- automatic snapshot/resync fetch;
- connection-status UI;
- reconnect/backoff;
- heartbeat;
- stale-duration policy;
- authority-unavailable presentation.

Those connection-resilience behaviors are ordered Phase 4.12 work. Transport selection remains blocked until a real backend producer/endpoint and delivery constraints can be verified.

## Validation target

Backend tests verify canonical envelope parsing and fail-closed continuity decisions.

Frontend tests independently verify the mirrored schema gate and confirm that duplicate, missing, stale/out-of-order, drifted and malformed events cannot advance the client cursor.

No Render runtime file, read-proxy path, dependency set, production configuration, secret or write capability is changed by this patch.
