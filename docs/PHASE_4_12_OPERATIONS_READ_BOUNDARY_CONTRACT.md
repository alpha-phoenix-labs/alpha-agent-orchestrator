# Phase 4.12 - Operations read boundary contract

Status: **CONTRACT SPECIFIED - TRANSPORT-NEUTRAL IMPLEMENTATION PERMITTED; NETWORK AUTH/ENDPOINT NOT YET SELECTED**

Applies to: Phase 4 read-only Operations Console live/snapshot integration.

This contract does not modify the frozen roadmap, authorize Phase 5 behavior, select a production authentication mechanism, create a network endpoint, change Render configuration, or authorize deployment.

## Evidence basis

The repository currently establishes these facts:

- `src/alpha_orchestrator/view_contracts.py` owns backend read-contract semantics, source classes, field availability/reason metadata and `view_payload()` serialization;
- frontend `OperationsSnapshot` is a UI composition type and is not backend authority;
- the default frontend currently has no authoritative snapshot transport;
- `LiveEventEnvelope`, `LiveEventProducer` and typed `SYSTEM_STATE` events already exist;
- SSE is the selected server-to-UI transport family and `encode_sse_event()` is the existing framing boundary;
- the existing Render read proxy has a Render-specific credential boundary and is not the general Operations API;
- repository evidence contains no general Operations browser authentication owner to reuse.

The missing boundary is therefore a shared, fail-closed read contract that can sit in front of both snapshot reads and SSE delivery without inventing the eventual credential mechanism.

## Contract ownership

The backend remains the source of truth.

The Operations read boundary may expose only backend-owned read material:

- snapshot material serialized from `ViewContract` values with `view_payload()`;
- live material serialized from canonical `LiveEventEnvelope` values with `encode_sse_event()`.

The boundary must not accept frontend-computed authority, approval state, write eligibility, Finding classification, lock state, policy results or telemetry-derived authority.

## Shared authorization decision

Snapshot reads and SSE reads must pass through the same repository-owned authorization decision point.

The transport-neutral boundary must not define the credential format. The authorization input is opaque to the boundary so that a later network adapter can use the actually approved mechanism.

Required behavior:

- authorization is mandatory for snapshot and SSE reads;
- missing authorizer, denied authorization or authorization failure is fail-closed;
- there is no default-allow path;
- authorization success grants read access only;
- authorization cannot grant Writer, approval, execution, deploy, unlock, policy override or other mutation capability;
- provider credentials must never be returned to the caller.

A concrete header, cookie, token name, bearer scheme, CORS policy or identity provider is intentionally not selected here.

## Snapshot transport contract

The first backend transport aggregate is a read-only snapshot envelope with:

- `schema_version` fixed to `1`;
- `state_version` copied from exactly one available, `AUTHORITATIVE` `SYSTEM_STATE.state_version` field;
- `contracts` containing the supplied backend `ViewContract` values serialized through `view_payload()` without removing `source_class`, `available` or `reason` metadata.

The aggregate must reject fail-closed when:

- no `SYSTEM_STATE` contract is present;
- more than one `SYSTEM_STATE` contract is present;
- `SYSTEM_STATE.state_version` is unavailable;
- the state-version field is not `AUTHORITATIVE`;
- the state version is not a non-empty string.

This envelope is a backend transport contract. It does not make the frontend `OperationsSnapshot` type authoritative and it does not yet define frontend slot-mapping semantics such as active Work Order or Leader selection.

## SSE transport contract

The boundary may emit only canonical `LiveEventEnvelope` instances through the existing SSE encoder.

SSE delivery does not promote authority:

- connection success != current authoritative snapshot;
- event delivery != verification or approval;
- sequence/state drift still requires resync;
- reconnect success alone does not restore authority;
- malformed events remain fail-closed.

## Explicit non-scope

Still unresolved and therefore not invented by this contract:

- HTTP route names;
- native `EventSource` versus fetch-based SSE;
- browser credential/header strategy;
- same-origin/CORS policy;
- concrete identity provider or token format;
- heartbeat cadence/timeout;
- replay buffer / `Last-Event-ID` policy;
- frontend `OperationsSnapshot` slot mapping;
- automatic snapshot resync network dispatch;
- deployment or Render service changes.

## Security invariants

The implementation must preserve:

- backend/Control Plane authority;
- `TELEMETRY != AUTHORITY`;
- explicit UNKNOWN / STALE / UNAVAILABLE states;
- no stale snapshot presented as current after connection loss;
- no Phase 5 write control;
- no secret output or logging;
- no reuse of the Render-specific proxy credential contract as a generic Operations credential contract without a separately approved architecture change.

## Acceptance for the transport-neutral implementation

The contract-level implementation is accepted only when tests prove:

- snapshot and SSE reads both require the same injected authorization boundary;
- denied/failed authorization produces no snapshot or SSE payload;
- snapshot serialization preserves authority and availability metadata;
- invalid/missing authoritative `SYSTEM_STATE.state_version` is rejected;
- SSE output uses the existing canonical encoder;
- no mutation capability, HTTP endpoint, production configuration or secret handling is added.

Network integration remains blocked until a concrete browser authentication mechanism and endpoint owner are verified separately.
