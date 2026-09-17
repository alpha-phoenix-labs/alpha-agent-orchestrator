# Phase 4.12 - Operations network owner decision

Status: **NETWORK OWNER SELECTED; BROWSER IDENTITY/AUTH MECHANISM NOT YET SELECTED**

Applies to: Phase 4 read-only Operations Console snapshot + SSE network integration.

This decision does not modify the frozen roadmap, authorize Phase 5 behavior, provision a service, select a production credential, change Render/Vercel configuration, merge a pull request, or authorize deployment.

## Verified evidence basis

The decision is based on the currently verified repository and runtime state:

- `src/alpha_orchestrator/operations_read.py` now owns the transport-neutral shared read boundary for snapshot and SSE and requires an injected `OperationsReadAuthorizer`;
- backend `ViewContract` values remain the authority source for snapshot material;
- canonical `LiveEventEnvelope` values remain the only permitted SSE event material;
- the default frontend still mounts `OperationsDataProvider` without a real authoritative snapshot/network client;
- the frontend package has React/Router/Tailwind/Vitest dependencies only and contains no verified browser identity/authentication integration;
- the existing Render service `alpha-agent-orchestrator-render-read-proxy` runs `scripts/render_read_proxy_server.py`, is deployed from `main`, and is a Render-specific Phase 3 read proxy;
- that proxy's client bearer credential and privileged Render provider credential are specific to the Render read-proxy boundary and are not a general Operations browser identity contract;
- the relevant Render service has auto-deploy disabled and its verified live deploy remains on the Phase 3/main commit, not the Phase 4 branch;
- no accessible Vercel team/project currently provides an Operations Console hosting or identity boundary.

Therefore there is no verified existing browser-authenticated service that can safely be reused as the Phase 4 Operations network owner.

## Decision

The repository will treat a **dedicated Operations Read Gateway** as the logical network owner for Phase 4 snapshot + SSE reads.

The Operations Read Gateway is distinct from the Render provider proxy.

Its responsibilities are limited to:

1. receive an already-defined browser authentication context from an approved authentication adapter;
2. pass that context through the repository-owned `OperationsReadBoundary` authorization decision;
3. expose authoritative snapshot bytes produced from backend `ViewContract` values;
4. expose canonical SSE bytes produced from `LiveEventEnvelope` values;
5. preserve fail-closed connection/resync semantics required by Phase 4.12;
6. emit no provider credential, Writer capability, approval capability, execution capability, deploy capability, unlock capability, or policy override.

The gateway does not own provider credentials and must not become a generic forward proxy.

## Required same-boundary rule

Snapshot and SSE must be owned by the same logical Operations Read Gateway and pass through the same injected authorization decision point.

A future network adapter must not create a weaker SSE authorization path than the snapshot path.

Connection establishment does not establish authority. The UI may regain authority only after a current authoritative snapshot is available under the existing resilience rules.

## Browser authentication responsibility

The Operations Read Gateway owns enforcement of browser read authorization, but the concrete identity/credential mechanism is intentionally unresolved.

There is currently no verified repository or hosting identity system to select without invention.

Until a concrete browser identity mechanism is human-approved and evidenced, the following remain prohibited from implementation as if authoritative:

- bearer-token variable names or token formats;
- cookies or session formats;
- OIDC/OAuth provider selection;
- identity-provider tenant/application configuration;
- CORS/origin policy based on an unverified deployment topology;
- native `EventSource` versus fetch-stream selection when that choice depends on credential transport;
- production/preview endpoint URLs;
- service provisioning or deployment.

## Hosting boundary

The logical owner is selected; a physical hosting target is not.

The existing Render read proxy must remain Render-specific. Reusing its service, client token, or provider credential as the Operations browser boundary would require a separate approved architecture change and is not authorized by this decision.

No Vercel project is currently verified for this repository, so Vercel is not treated as an existing deployment owner.

A later approved deployment may place the dedicated Operations Read Gateway on an appropriate runtime, but that placement must preserve the repository-owned contract and must not silently couple Operations authentication to provider authentication.

## Security invariants

The following remain mandatory:

- backend / Control Plane remains authority;
- `TELEMETRY != AUTHORITY`;
- UNKNOWN / STALE / UNAVAILABLE remain explicit;
- stale retained data is never presented as current authority;
- snapshot + SSE share one authorization boundary;
- provider credentials remain behind provider-specific server-side boundaries;
- no default-allow authentication path;
- no Phase 5 mutation controls;
- no secrets in browser payloads or logs;
- no merge or deploy without the required Human Gate.

## Implementation consequence

Transport-neutral backend implementation may continue behind `OperationsReadBoundary`.

Network endpoint implementation is blocked only on the concrete browser identity/authentication mechanism and the approved physical hosting boundary. The route names and credential transport should be selected together with that mechanism rather than invented beforehand.

## Current Human Gate

Before a real browser network adapter or deployable Operations service is added, a human must approve the browser identity/authentication approach and the intended development/preview hosting boundary.

Acceptance for that gate:

- the identity mechanism is named and has an accountable owner;
- the browser credential/session transport is defined;
- snapshot and SSE can use the same authorization decision without exposing provider credentials;
- the hosting target is development/preview scoped;
- no production deployment or Phase 5 write capability is implied.
