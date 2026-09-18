# Phase 4.12 - Browser auth and preview hosting decision

Status: **DEVELOPMENT/PREVIEW AUTH + HOSTING IMPLEMENTED AND RUNTIME-VERIFIED; PRODUCTION AUTH UNRESOLVED**

Applies to: Phase 4 read-only Operations Console snapshot + SSE runtime proof.

This decision is limited to DEVELOPMENT/PREVIEW. It does not authorize production authentication, Phase 5 write capability, merge to a protected branch, production traffic, or future secret changes.

## Verified evidence basis

The repository/runtime now establishes:

- `src/alpha_orchestrator/operations_read.py` owns the shared fail-closed authorization decision for snapshot and SSE reads;
- the dedicated Operations Read Gateway is distinct from the Render provider proxy;
- the browser path uses fetch-based SSE because the selected preview credential is sent through an `Authorization` header;
- the DEVELOPMENT/PREVIEW credential represents the fixed preview principal `DEVELOPMENT_OPERATOR`;
- the credential is opaque, server-side configured, provider-independent and read-only;
- browser credential handling is memory-only;
- the mounted frontend live provider uses the same credential for snapshot and SSE;
- the preview-session credential entry surface is explicitly gated to DEVELOPMENT/PREVIEW mode;
- deterministic browser E2E proves the credential is not persisted in localStorage, sessionStorage or cookies;
- the dedicated Render Operations Preview service has been provisioned and deployed with auto-deploy disabled;
- external CI smoke verifies the protected read-only preview service.

## Development/preview browser authorization

The credential remains subject to these mandatory properties:

- random/opaque;
- never a provider credential;
- never committed to the repository;
- never emitted in logs, URLs, query parameters, telemetry, audit payloads or UI state;
- browser memory only for the active preview session;
- not persisted in localStorage, sessionStorage, cookies, generated static assets or build-time public frontend configuration;
- snapshot and SSE use the same `Authorization: Bearer ...` credential and same Operations read boundary;
- denied, missing or malformed credentials fail closed;
- authorization grants read access only.

The current UI input exists only when:

1. `VITE_ENABLE_OPERATIONS_PREVIEW_SESSION=true`; and
2. the page is explicitly opened with `?operationsPreview=read`.

The ordinary application path therefore does not expose a credential input or additional session control.

## SSE browser transport

Fetch-based SSE remains the selected Phase 4 DEVELOPMENT/PREVIEW transport because caller-defined Authorization headers are required.

The client:

- sends the bearer credential for snapshot and SSE;
- requires successful HTTP responses;
- requires `text/event-stream` for event reads;
- parses canonical live-event frames only;
- runs sequence/state validation before state application;
- treats disconnect, malformed framing, authorization loss, sequence gaps and state drift fail-closed;
- never infers authority from connection state alone.

## Dedicated Render preview service

Confirmed DEVELOPMENT/PREVIEW service:

- service: `alpha-agent-orchestrator-operations-preview`;
- Render service id: `srv-dam5g5gu01pc73bia2t0`;
- endpoint: `https://alpha-agent-orchestrator-operations.onrender.com`;
- repository: `alpha-phoenix-labs/alpha-agent-orchestrator`;
- branch: `phase4/premium-mission-control-remediation`;
- auto-deploy: disabled;
- runtime: Python;
- start command: `python scripts/operations_preview_server.py`;
- health route: `/healthz`;
- purpose: Operations Read Gateway DEVELOPMENT/PREVIEW only;
- no provider credentials exposed to browser;
- no write capability.

Last independently confirmed live deploy:

- deploy id: `dep-dam5q5m5vjqs73bs36qg`;
- commit: `b4ae402ba192c953fa86b56d16c1446b4fc16068`;
- status: live.

Later branch commits are not treated as deployed merely because repository CI is green.

## Current runtime verification

External CI smoke verifies the deployed service for:

- health contract;
- missing credential -> 401 with no snapshot body;
- authenticated snapshot;
- canonical SSE response;
- SHADOW / writes disabled semantics;
- POST mutation attempt -> 405.

The mounted browser session is separately verified through the controlled HTTP/SSE E2E runtime harness for reconnect, sequence gap, resync, failed resync, stale and authority-unavailable behavior.

These evidence classes are intentionally kept distinct:

- external Render smoke proves the real deployed protected gateway;
- deterministic browser runtime proves the mounted client resilience behavior;
- neither is used to invent unsupported authority data.

## Security and authority invariants

Unchanged:

- backend/Control Plane remains authority;
- `TELEMETRY != AUTHORITY`;
- connection success != current authoritative snapshot;
- reconnect success alone != restored authority;
- UNKNOWN / STALE / UNAVAILABLE remain explicit;
- provider credentials remain behind provider-specific server-side boundaries;
- no default-allow path;
- no browser secret persistence;
- no Phase 5 mutation controls;
- no production deploy.

## Deferred

Production identity/auth remains unresolved.

No claim is made that the DEVELOPMENT_OPERATOR bearer model is suitable for production.

Any future production identity mechanism, origin/CORS topology, session model or secret rotation requires its own evidence and Human Gate.
