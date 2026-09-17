# Phase 4.11 - Live event ingestion and schema safety

Status: **FOUNDATIONAL PATCH + BACKEND ENVELOPE PRODUCER + ONE TYPED SYSTEM_STATE EVENT FAMILY + SSE SELECTED; ENDPOINT NOT YET IMPLEMENTED**

Baseline: `main@a65ffbbb1be5557b1810ca140d715b911e26b286`

## Scope

This work establishes the Phase 4.11 safety boundary required before any live event stream may mutate Operations Console state.

The frozen roadmap requires enough event identity/versioning to detect duplicate events, missing sequence, stale/out-of-order delivery, state-version drift and snapshot/resync requirements. It also requires explicit schema validation and guarantees that invalid or schema-incompatible events do not mutate authoritative UI state.

## Verified current state

The current Phase 4 development branch contains:

- `src/alpha_orchestrator/live_events.py` with the canonical envelope and fail-closed continuity checks;
- `src/alpha_orchestrator/live_event_producer.py` with a backend envelope producer;
- `src/alpha_orchestrator/live_event_payloads.py` with one typed event family derived directly from the existing backend-owned `SYSTEM_STATE` view contract;
- `src/alpha_orchestrator/live_sse.py` with the selected SSE framing boundary;
- the frontend mirror and fail-closed event validator.

SSE is now selected for the verified one-way server-to-UI Phase 4 live requirement. A network streaming endpoint is still not implemented, so this is not runtime evidence that a live stream exists.

## Canonical state-version correction

A root-cause check found that the authoritative `StateSnapshot.version` used by guards, approvals, Work Orders and `SYSTEM_STATE` is a string digest, while the original Phase 4.11 event cursor modeled state versions as non-negative integers.

The live-event envelope and frontend mirror therefore use non-empty string state versions. Continuity is checked by exact equality between `base_state_version` and the cursor's current authoritative state version. Ordering remains the responsibility of the integer `sequence` field.

## Canonical envelope

The backend-owned schema defines:

- `schema_version`
- `event_id`
- `sequence`
- `base_state_version`
- `state_version`
- `emitted_at`
- `event_type`
- `payload`

Schema version `1` remains accepted. `base_state_version` and `state_version` are non-empty canonical state-version strings.

## Backend envelope producer

`LiveEventProducer`:

- starts from explicit `last_sequence` and `current_state_version`;
- emits monotonic sequence numbers;
- sets `base_state_version` from its current baseline;
- requires a non-empty next state version;
- requires unique event identities for the producer lifetime;
- requires timezone-aware timestamps;
- validates the complete generated envelope before advancing its cursor;
- does not grant authority or apply payloads to frontend state.

## Typed SYSTEM_STATE event family

`VIEW_CONTRACT_SYSTEM_STATE` is a direct typed mirror of the existing `SYSTEM_STATE` view contract:

- `contract = SYSTEM_STATE`
- `source_class = AUTHORITATIVE`
- `mode`
- `writes_enabled`
- `state_version`

The payload builder fails closed for the wrong contract, unavailable fields, wrong provenance or invalid field types. `emit_system_state(...)` derives the envelope state version from the typed payload's existing authoritative state version.

## Selected transport framing

SSE is selected because the verified Phase 4 live flow is server -> UI only and no bidirectional browser control requirement exists.

`src/alpha_orchestrator/live_sse.py` provides framing only:

- content type `text/event-stream; charset=utf-8`;
- `id` = canonical event ID;
- `event` = canonical event type;
- `data` = complete canonical envelope as compact JSON;
- blank-line record termination;
- CR/LF injection in `id` or `event` is rejected.

This does not expose an endpoint or choose authentication, heartbeat cadence, retry cadence, replay persistence or snapshot-resync URL. Native browser `EventSource` is also not yet mandated because the concrete browser connection mechanism depends on the verified authentication contract.

## Safety decisions

The ingestion gate returns `ACCEPTED`, `DUPLICATE`, `RESYNC_REQUIRED` or `INVALID`.

Malformed schema, duplicate identity, sequence collision, stale/out-of-order delivery, missing sequence, state-version drift and invalid typed payloads fail closed without advancing authoritative domain state.

`ACCEPTED` means only that the envelope is structurally and sequentially safe. It does not mean verified, approved, write-eligible or authoritative by itself.

## Authority boundaries

The following remain mandatory:

- `TELEMETRY != AUTHORITY`;
- live event delivery != Audit authority;
- animation/activity != verification;
- client-side validation never grants write eligibility;
- malformed or incompatible events never mutate authoritative UI state;
- no Writer, approval, deploy, unlock or execution capability is added.

## Deferred / blocked

Not yet implemented:

- backend HTTP streaming endpoint;
- browser live connection;
- transport authentication;
- replay / `Last-Event-ID` semantics;
- heartbeat policy;
- reconnect network dispatch;
- authoritative snapshot-resync endpoint;
- typed payload application into `OperationsSnapshot`;
- additional typed event families.

See `docs/PHASE_4_11_LIVE_TRANSPORT_DECISION.md` for the transport decision and remaining runtime gate.

No Render runtime file, production configuration, secret or write capability is changed by this patch.
