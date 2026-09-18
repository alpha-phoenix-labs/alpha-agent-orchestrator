# Phase 4.11 - Live transport decision

Status: **SSE SELECTED FOR SERVER-TO-UI LIVE EVENT DELIVERY - ENDPOINT NOT YET IMPLEMENTED**

## Evidence basis

The current Phase 4 branch now has:

- a canonical live-event envelope with identity, sequence and state-version continuity checks;
- a backend `LiveEventProducer`;
- one typed backend-owned event family derived from `SYSTEM_STATE`;
- frontend fail-closed event validation;
- client resilience state for connection loss, reconnect wait, stale data and resync requirements.

The currently verified live requirement is one-way delivery from backend to the read-only Operations Console. There is no verified requirement for browser-to-backend live commands, multiplexed bidirectional RPC, binary frames or high-frequency peer-style messaging.

## Decision

**Server-Sent Events (SSE) is selected as the Phase 4 live event transport family.**

Rationale:

- the verified data flow is server -> UI only;
- Phase 4 remains read-only and must not introduce control-plane write shortcuts;
- SSE maps directly onto ordered textual event envelopes over HTTP;
- browser and server implementations can remain dependency-light;
- reconnect/resync semantics already exist independently in the client resilience model;
- WebSocket would add bidirectional protocol surface without a verified Phase 4 need.

This decision does not make native browser `EventSource` mandatory. The concrete browser connection API remains dependent on the verified authentication contract because native `EventSource` has different credential/header constraints than a fetch-based streaming client.

## Implemented framing boundary

`src/alpha_orchestrator/live_sse.py` defines the current SSE framing contract:

- content type: `text/event-stream; charset=utf-8`;
- `id` is the canonical event ID;
- `event` is the canonical event type;
- `data` contains the complete canonical live-event envelope as compact JSON;
- each record terminates with a blank line;
- CR/LF injection in `id` or `event` is rejected fail-closed.

The framing layer does not expose a network endpoint and does not choose retry cadence, heartbeat cadence, replay persistence, authentication, CORS policy or snapshot/resync URL.

## Authority and safety boundary

SSE delivery does not grant authority. The following remain unchanged:

- `TELEMETRY != AUTHORITY`;
- event delivery != verification or approval;
- connection success != current authoritative snapshot;
- reconnect success != authority restoration;
- sequence/state drift requires resync;
- malformed frames/events must not mutate authoritative UI state;
- no Writer, approval, deploy, unlock or execution capability is added.

## Explicitly deferred

The next implementation step is blocked on a verified backend endpoint/authentication boundary and snapshot-resync path. Until those are defined, this decision is not runtime evidence that a live stream exists.

Not yet implemented:

- HTTP streaming endpoint;
- browser live connection;
- transport authentication;
- replay buffer / `Last-Event-ID` semantics;
- heartbeat interval and timeout;
- reconnect network dispatch;
- authoritative snapshot resync endpoint;
- typed payload application into `OperationsSnapshot`.

## Acceptance

This decision is satisfied when:

- SSE framing tests pass;
- existing backend/frontend safety tests remain green;
- no new write capability or production deployment is introduced.

Phase 4 runtime-live acceptance remains blocked until a real producer -> SSE endpoint -> browser delivery path is exercised with disconnect, reconnect, gap/resync and authority-unavailable evidence.
