# Phase 4.11 - Live event ingestion and schema safety

Status: **REAL SSE DELIVERY + MOUNTED BROWSER INGESTION + RECENT EVENTS SURFACE IMPLEMENTED — PHASE 4 READ-ONLY**

Applies to: Phase 4 SHADOW / read-only Operations Console.

## Scope

Phase 4.11 establishes the live-event safety boundary required before an event may affect current Operations Console state or appear in the live Recent Events product surface.

The frozen roadmap requires enough event identity/versioning to detect duplicate events, missing sequence, stale/out-of-order delivery, state-version drift and snapshot/resync requirements. Invalid or schema-incompatible events must fail closed and must not mutate authoritative UI state.

The approved Premium Frontend Acceptance amendment additionally requires a real read-only Recent Events surface once a backend/live contract is available.

## Current verified implementation

The current Phase 4 branch contains:

- `src/alpha_orchestrator/live_events.py` with the canonical envelope and fail-closed continuity checks;
- `src/alpha_orchestrator/live_event_producer.py` with a repository-owned envelope producer;
- `src/alpha_orchestrator/live_event_payloads.py` with the typed `VIEW_CONTRACT_SYSTEM_STATE` family;
- `src/alpha_orchestrator/live_sse.py` with canonical SSE framing;
- the protected Operations snapshot + SSE HTTP boundary;
- the frontend canonical envelope parser/evaluator;
- typed `SYSTEM_STATE` event application into the Operations snapshot;
- mounted browser snapshot/SSE ingestion;
- reconnect, stale, sequence-gap, resync and unavailable handling;
- a Mission Control Recent Events surface backed by accepted live-event metadata.

External DEVELOPMENT/PREVIEW smoke verifies the real repository-owned producer and protected HTTP/SSE delivery path. Controlled browser E2E verifies mounted client ingestion and UI behavior through actual HTTP/SSE requests.

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

Schema version `1` is accepted. State versions are non-empty canonical strings. Ordering is carried by the integer sequence.

## Typed SYSTEM_STATE event family

`VIEW_CONTRACT_SYSTEM_STATE` is a typed mirror of the existing backend-owned `SYSTEM_STATE` view contract:

- `contract = SYSTEM_STATE`
- `source_class = AUTHORITATIVE`
- `mode`
- `writes_enabled`
- `state_version`

The typed application path rejects the wrong contract, wrong source class, invalid field types or state-version mismatch.

An accepted event is still not an approval, verification result or permission grant. It is accepted only for schema/continuity and supported typed application.

## Recent Events contract decision

The existing canonical `LiveEventEnvelope` plus the supported `VIEW_CONTRACT_SYSTEM_STATE` family is an available backend/live contract for the Premium Frontend Acceptance requirement for Recent Events.

Therefore the product surface is now backed directly by accepted live events rather than by the unrelated `AUDIT` collection.

The Recent Events presentation deliberately projects only bounded safe metadata from an accepted event:

- emitted timestamp;
- event type;
- sequence;
- resulting state version;
- contract identity when supplied;
- source class when supplied.

The arbitrary event payload is not forwarded to the Recent Events UI.

This is an explicit safety boundary: future event families do not automatically gain payload rendering merely because their envelope is accepted.

Recent Events is observability only:

- live event != Audit authority;
- live event != Evidence verification;
- live event != Finding classification;
- live event != Approval;
- live event != write eligibility;
- live event activity != permission.

Accepted Recent Events are retained only in memory for the active read session and are bounded to the latest 20 records. Disconnecting the development read session clears the presentation buffer.

## Transport and browser behavior

SSE is selected for the verified one-way server-to-UI Phase 4 requirement.

The active browser path uses:

- an authoritative snapshot before current authority is exposed;
- the same bearer credential for snapshot and SSE;
- canonical SSE parsing;
- canonical envelope validation;
- contiguous sequence/state-version validation;
- supported typed event application;
- fail-closed resync when continuity is not proven.

A stream disconnect marks retained authority stale. Reconnect alone does not restore authority; a fresh authoritative snapshot is required.

Heartbeat is not currently required by the finite verified Phase 4 transport behavior. A future long-lived production transport must re-evaluate liveness/heartbeat requirements from runtime evidence.

## Safety decisions

The ingestion gate returns `ACCEPTED`, `DUPLICATE`, `RESYNC_REQUIRED` or `INVALID`.

Malformed schema, duplicate identity, sequence collision, stale/out-of-order delivery, missing sequence and state-version drift fail closed.

Only an `ACCEPTED` event that also passes supported typed snapshot application is added to Recent Events. Rejected, duplicate or resync-required envelopes are not promoted into the product surface as accepted activity.

## Secret and payload boundary

Recent Events does not render the raw envelope payload.

The UI receives only the safe metadata projection listed above, and presentation strings pass through the existing display redaction boundary.

Regression coverage explicitly proves that arbitrary payload fields, including a token-shaped test field, are not present in the Recent Events projection.

No token, cookie, credential, private key, capability token or full sensitive payload is authorized for Recent Events rendering.

## Current limitations

Current Phase 4 supports one typed live event family: `VIEW_CONTRACT_SYSTEM_STATE`.

Not claimed:

- additional typed event families;
- persistent event-history storage;
- replay / `Last-Event-ID` semantics;
- a standalone authoritative TRACE contract;
- conversion of live-event history into Audit;
- production identity/auth readiness;
- Phase 5 write behavior.

These limitations do not convert unavailable data into inferred authority.

## Phase 4.11 acceptance statement

For the current Phase 4 scope:

- canonical schema safety: implemented;
- real producer: implemented and externally smoke-verified;
- real SSE delivery: implemented and externally smoke-verified;
- mounted browser ingestion: implemented and browser-E2E verified;
- supported typed event application: implemented;
- Recent Events real read-only product surface: implemented against accepted live-event metadata;
- arbitrary payload rendering: prohibited;
- malformed/duplicate/gap/drift handling: fail-closed;
- write capability introduced by this work: none.

Final Phase-4 exit remains subject to the complete roadmap gate and explicit Human Phase-4 Exit / Phase-5 Entry decision.
