# Phase 4.11 - Live event ingestion and schema safety

Status: **FOUNDATIONAL PATCH + BACKEND ENVELOPE PRODUCER + ONE TYPED SYSTEM_STATE EVENT FAMILY - TRANSPORT NOT SELECTED**

Baseline: `main@a65ffbbb1be5557b1810ca140d715b911e26b286`

## Scope

This patch implements the transport-neutral Phase 4.11 safety boundary required before any live event stream may mutate Operations Console state.

The frozen roadmap requires live event design to provide enough identity/versioning to detect duplicate events, missing sequence, stale/out-of-order delivery, state-version drift and snapshot/resync requirements. It also requires explicit schema validation and guarantees that invalid or schema-incompatible events do not mutate authoritative UI state.

## Verified current state

At the original baseline above:

- the frontend had no `WebSocket`, `EventSource` or SSE integration;
- `OperationsDataProvider` received a snapshot as an injected value and did not own a live transport;
- the backend `AuditEvent` in `src/alpha_orchestrator/events.py` was append-only Audit state and was not a live UI event contract;
- no backend live-event endpoint or payload mutation contract existed in the repository.

The current Phase 4 development branch contains `src/alpha_orchestrator/live_event_producer.py`. It creates canonical envelopes from an explicit sequence/state-version baseline, assigns event identity and timezone-aware emission time, and advances its baseline only after canonical schema validation succeeds.

The branch now also contains one typed event family derived directly from the existing backend-owned `SYSTEM_STATE` view contract. It does not invent a new operational domain state: it mirrors the existing fields `mode`, `writes_enabled`, and `state_version` with their existing `AUTHORITATIVE` provenance.

Transport selection remains blocked until a real endpoint plus verified delivery requirements can be established.

## Canonical state-version correction

A root-cause check found that the authoritative `StateSnapshot.version` used by guards, approvals, Work Orders and `SYSTEM_STATE` is a string digest, while the original Phase 4.11 event cursor modeled state versions as non-negative integers.

That mismatch prevented a typed event from truthfully carrying the existing authoritative state version. The live-event envelope and frontend mirror now use non-empty string state versions. Continuity is checked by exact equality between `base_state_version` and the cursor's current authoritative state version.

No ordering comparison is made between state-version digests. Sequence ordering remains the responsibility of the integer `sequence` field.

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

Schema version `1` remains the accepted version. `base_state_version` and `state_version` are non-empty canonical state-version strings.

The frontend mirrors this envelope in `frontend/src/live-events.ts` for client-side validation. The frontend mirror does not redefine authority; it validates input before any future typed payload handler can act on it.

## Backend envelope producer

`LiveEventProducer` is transport-neutral and intentionally narrow:

- construction requires an explicit `last_sequence` and `current_state_version` baseline;
- emitted sequence numbers are monotonic from that baseline;
- `base_state_version` always equals the producer's current canonical state baseline;
- the next `state_version` must be a non-empty canonical state-version string;
- event identities must be unique for the lifetime of the producer instance;
- emission timestamps must be timezone-aware;
- the generated envelope is passed through the canonical `parse_live_event` validator before producer state advances;
- any validation failure leaves sequence/state cursor unchanged.

The producer does not create a replay buffer, persistence layer, socket connection, SSE response, heartbeat, reconnect policy or snapshot endpoint.

## Typed SYSTEM_STATE event family

`src/alpha_orchestrator/live_event_payloads.py` defines `VIEW_CONTRACT_SYSTEM_STATE`.

Its payload is a direct typed mirror of the existing `SYSTEM_STATE` view contract:

- `contract = SYSTEM_STATE`
- `source_class = AUTHORITATIVE`
- `mode`
- `writes_enabled`
- `state_version`

The payload builder fails closed if the wrong contract is supplied, if any required field is unavailable, if provenance is not `AUTHORITATIVE`, or if field types are invalid.

`LiveEventProducer.emit_system_state(...)` derives the envelope `state_version` from the typed payload's existing authoritative `state_version`. The producer's previous cursor state becomes `base_state_version`.

This event family does not grant authority, approval, health, write permission or execution capability. It also does not apply the payload to frontend state.

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
- invalid sequence;
- empty or non-string state versions;
- timestamp without an explicit timezone offset;
- invalid event type;
- non-object payload;
- sequence collision;
- stale/out-of-order sequence;
- missing sequence gap;
- base-state mismatch / state-version drift;
- unavailable or invalid typed `SYSTEM_STATE` payload fields.

A valid event advances only event cursor metadata. This patch intentionally does **not** apply payloads to `OperationsSnapshot` or any other authoritative UI model.

`ACCEPTED` means only that the envelope and typed payload are structurally and sequentially safe for a later explicitly reviewed handler. It does not mean verified, approved, write-eligible or authoritative by itself.

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

- additional typed event families;
- WebSocket/SSE/other transport selection;
- backend streaming endpoint;
- replay/persistence semantics;
- typed payload application into `OperationsSnapshot`;
- automatic snapshot/resync fetch;
- connection-status network integration;
- reconnect network dispatch;
- heartbeat transport policy;
- stale-duration policy.

Those connection-resilience behaviors remain ordered Phase 4.12 work. Transport selection remains blocked until a real endpoint and delivery constraints can be verified.

## Validation target

Backend tests verify canonical envelope parsing and fail-closed continuity decisions.

Backend producer tests verify monotonic sequence generation, canonical state-version continuity, duplicate identity rejection, timezone-aware timestamps, canonical schema validation and no cursor advancement on failure.

Typed payload tests verify exact `SYSTEM_STATE` provenance and fields, plus fail-closed handling when an authoritative field is unavailable.

Frontend tests independently verify the mirrored schema gate and confirm that duplicate, missing, stale/out-of-order, drifted and malformed events cannot advance the client cursor.

No Render runtime file, read-proxy path, dependency set, production configuration, secret or write capability is changed by this patch.
