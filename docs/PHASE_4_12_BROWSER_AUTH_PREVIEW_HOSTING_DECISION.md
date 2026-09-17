# Phase 4.12 - Browser auth and preview hosting decision

Status: **DEVELOPMENT/PREVIEW AUTH + HOSTING SELECTED; NO SERVICE PROVISIONED OR DEPLOYED**

Applies to: Phase 4 read-only Operations Console snapshot + SSE runtime proof.

This decision is limited to DEVELOPMENT/PREVIEW. It does not authorize production authentication, Phase 5 write capability, a merge to a protected branch, secret provisioning, service creation, or deployment.

## Verified evidence basis

The current repository/runtime evidence establishes:

- `src/alpha_orchestrator/operations_read.py` already owns the shared fail-closed authorization decision for snapshot and SSE reads;
- `docs/PHASE_4_12_OPERATIONS_NETWORK_OWNER_DECISION.md` selects a dedicated Operations Read Gateway, separate from the Render provider proxy;
- the existing Render service is a provider-specific Phase 3 read proxy and must not be reused as the Operations browser auth boundary;
- the frontend currently has no verified browser identity/auth integration;
- there is no accessible Vercel team/project for this repository;
- the verified Render workspace is available and already hosts the separate provider proxy;
- browser `EventSource` does not support caller-defined `Authorization` headers, while `fetch()` supports custom request headers.

## Development/preview browser authorization decision

For Phase 4 DEVELOPMENT/PREVIEW runtime proof, the Operations Read Gateway will use a repository-owned **opaque development operator bearer credential**.

The credential represents one fixed preview principal:

`DEVELOPMENT_OPERATOR`

This is an authorization mechanism for controlled Phase 4 preview only. It is not a production identity system and must not be promoted to one by implication.

Required properties:

- the credential is random/opaque and configured server-side only;
- it is never a provider credential;
- it is never committed to the repository;
- it is never emitted in logs, URLs, query parameters, telemetry, audit payloads or UI state;
- the browser may hold it in memory only for the active preview session;
- it must not be persisted in `localStorage`, `sessionStorage`, cookies, build-time frontend environment variables, source code or generated static assets;
- snapshot and SSE requests use the same `Authorization: Bearer ...` credential and the same injected `OperationsReadBoundary` authorization decision;
- denied, missing or malformed credentials fail closed with no snapshot or SSE payload;
- authorization grants read access only and cannot create Writer, approval, execution, deploy, unlock, policy override or other mutation capability.

The preview credential may be supplied interactively to the browser session or by the isolated E2E harness. The exact UI entry surface is implementation detail and must not weaken the no-secret-persistence rules above.

## SSE browser transport decision

Because the selected DEVELOPMENT/PREVIEW authorization uses an `Authorization` request header, the browser live client will use **fetch-based SSE streaming**, not native `EventSource`.

This choice is constrained to the current preview credential transport. It does not make fetch-based SSE a permanent production requirement.

The fetch-based client must:

- send the same bearer credential used for snapshot reads;
- require an HTTP success response with `text/event-stream` content type;
- parse only canonical SSE frames that contain the existing `LiveEventEnvelope` representation;
- feed events through the existing sequence/state-version validation before any domain-state application;
- treat disconnect, malformed framing, authorization loss, sequence gaps and state drift as fail-closed resilience events;
- never infer authority from a connected stream alone.

## Development/preview hosting decision

The intended physical Phase 4 preview target is a **new dedicated Render web service** in the confirmed `ventomlabs` workspace, region Frankfurt, separate from `alpha-agent-orchestrator-render-read-proxy`.

Required deployment properties when deployment is later authorized:

- repository: `alpha-phoenix-labs/alpha-agent-orchestrator`;
- branch: the current Phase 4 development branch or a later explicitly approved preview branch;
- purpose: Operations Read Gateway DEVELOPMENT/PREVIEW only;
- auto-deploy: disabled;
- no reuse of the existing Render provider-proxy client token or provider token;
- no provider credentials exposed to the gateway browser boundary;
- no write capability;
- no production domain or production traffic;
- explicit Human Gate required before service creation, secret provisioning or deploy.

A deployment must be tied to an exact commit SHA with green CI and must be re-verified after deployment.

## Security and authority invariants

The following remain mandatory:

- backend/Control Plane remains authority;
- `TELEMETRY != AUTHORITY`;
- connection success != current authoritative snapshot;
- reconnect success alone != restored authority;
- UNKNOWN / STALE / UNAVAILABLE remain explicit;
- snapshot + SSE share one authorization decision;
- provider credentials remain behind provider-specific server-side boundaries;
- no default-allow path;
- no browser secret persistence;
- no Phase 5 mutation controls;
- no production deploy.

## Implementation consequence

The architecture gate for browser credential transport and development/preview hosting is now selected.

The next implementation may add a fail-closed HTTP adapter for the Operations Read Gateway and a fetch-based browser SSE client, but it must remain non-deploying until:

1. gateway unit/integration tests are green;
2. browser E2E proves snapshot + SSE use the same authorization boundary;
3. disconnect/gap/resync/stale/unavailable behavior is proven;
4. the preview service creation + credential provisioning step receives a separate explicit Human Gate.

## Exit condition for this decision

This decision is satisfied when code and tests prove the selected DEVELOPMENT/PREVIEW auth/transport contract without creating or exposing a real secret and without provisioning a service.

Production identity/auth remains explicitly unresolved and belongs to a later gate.
