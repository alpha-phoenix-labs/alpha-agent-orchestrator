# Phase 3 — Real Read-Only Preparation

This phase prepares and validates live observation of external systems without enabling any write path.

## Security boundary

1. Agent asks for an approved logical source + URL.
2. Deterministic ReadBroker validates HTTPS, host and path allowlists.
3. Backend-only transport applies credentials.
4. Response must be 2xx JSON and below the configured size limit.
5. Agent receives parsed payload + provenance only, never the credential/header set.
6. Observation is converted to EvidenceRef for independent verification.
7. Consumers must enforce an explicit freshness window before using an observation for a decision.

## GitHub Phase-3 baseline

The GitHub baseline uses `GitHubReadTransport` behind `ReadBroker`.

The transport has these enforced properties:
- fixed HTTP method: `GET`;
- no caller method parameter;
- no caller header parameter;
- credential is injected only inside the backend transport;
- credential is redacted from transport representation and never copied into `TransportResponse` or `ReadObservation`;
- connection failures are surfaced as sanitized read-plane errors;
- response size is bounded before returning to the broker;
- GitHub host/path access remains constrained by `github_policy()` to explicit repositories.

`ReadObservation.require_fresh()` fails closed on stale, future-dated, malformed or timezone-less observation timestamps.

## GitHub real-read smoke

`scripts/phase3_github_real_read.py` is the single-purpose acceptance smoke for GitHub. It performs exactly one authenticated GET to:

`https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`

The script checks repository identity, 2xx JSON, observation freshness <= 60 seconds and provenance fields while exposing no credential or write surface.

## Historical GitHub real-read runtime evidence

The first approved GitHub real-read gate used a one-time validation workflow from branch `phase3/real-read-validation` and then removed that workflow from the persistent repository state.

Evidence:
- validation commit: `036feb0734f97c747927b5dfb43169cbf2b0a8f8`;
- workflow run: `35093964987` (`phase3-real-read-validation`);
- job: `104786641659` (`real-read`);
- result: `SUCCESS`;
- GitHub-provided token permissions: `Contents: read`, `Metadata: read`;
- checkout used `persist-credentials: false`;
- runtime mode: `READ_ONLY`;
- writes enabled: `false`;
- authenticated smoke result: `PHASE3_REAL_READ: PASS`;
- source: `github`;
- HTTP status: `200`;
- observed at: `2026-09-16T12:06:55.467828+00:00`;
- body digest: `fa1f59e4430ca5feb63f381389d6e768ed191918a10cf1112d8db832056bdb6d`;
- body size: `7731` bytes;
- reported application write surface: `WRITE_CAPABILITY_EXPOSED: false`.

No repository secret was created or changed for this validation. The credential was the ephemeral GitHub Actions token constrained by the workflow to read permissions. The token value was masked and is not recorded in repository content or evidence output.

## Current-main GitHub runtime refresh

After the Phase 3.5 provenance contract was merged, the GitHub read path was revalidated from exact repository baseline `main@e4c033cf16e0a1ab50d5b294bef4cd93ffaecb05`.

Evidence:
- validation commit: `7724fd39294745291390caf5a3cbb3451b3c358f`;
- workflow run: `35131954979`;
- job: `104914852984`;
- result: `SUCCESS`;
- GitHub token permissions: `Contents: read`, `Metadata: read`;
- checkout used `persist-credentials: false`;
- runtime mode: `READ_ONLY`;
- writes enabled: `false`;
- `PHASE3_REAL_READ: PASS`;
- source: `github`;
- target id: `github:api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`;
- observed URL: `https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`;
- HTTP status: `200`;
- observed at: `2026-09-16T18:03:11.753750+00:00`;
- body digest: `0469357508c52932a64836bd286112e5354e3d0d07580e24b0a1d84fa9f7c173`;
- body size: `7731`;
- freshness result: `FRESH`;
- collector: `alpha_orchestrator.read_plane.ReadBroker`;
- transport: `alpha_orchestrator.connectors.github_http_transport.GitHubReadTransport`;
- verification state: `READ_VALIDATED`;
- `WRITE_CAPABILITY_EXPOSED: false`.

The temporary validation workflow was removed after the run. No credential value was emitted and no runtime write operation was performed.

## Render Phase-3 root-cause finding

The previous Render policy used broad prefix allowlisting for `/v1/services`, `/v1/deploys` and `/v1/postgres`. That is not sufficient as a secret boundary.

Render exposes sensitive GET endpoints below otherwise valid resource paths, including service environment-variable reads and Postgres credential/export reads. Therefore a prefix such as `/v1/services` would also admit a URL like `/v1/services/{serviceId}/env-vars` unless an additional positive path constraint is enforced.

This is a confirmed security defect in the previous Render read-policy model, not a reason to weaken Phase-3 acceptance.

The corrected runtime policy uses positive path templates only:
- `/v1/services`;
- `/v1/services/{serviceId}`;
- `/v1/services/{serviceId}/deploys`;
- `/v1/services/{serviceId}/deploys/{deployId}`;
- `/v1/postgres`.

Sensitive descendants such as `/env-vars`, `/secret-files`, `/credentials` and `/export` are outside the positive allowlist and fail closed.

## Render backend transport

`RenderReadTransport` is the Render equivalent of the GitHub read transport. It has a fixed `GET` method, owns its bearer credential inside the backend transport, accepts no caller headers or method override, bounds response size, sanitizes transport errors and redacts the credential from representation/output.

The backend environment variable is `ALPHA_RENDER_READ_TOKEN`. It must never be committed.

Important limitation: a Render API key is a privileged provider credential. The security boundary therefore depends on keeping the key reachable only through the constrained GET-only transport/proxy. Provider-side credential privilege itself must not be described as read-only unless independently proven.

## Render provider-side live-read evidence

After explicit user approval of workspace `ventomlabs` (`tea-da5lqvuk1f9s73918ul0`), live Render connector reads were performed in this development session.

CONFIRMED observations:
- workspace list resolved the approved workspace;
- service listing returned Render service metadata;
- Postgres listing returned provider metadata;
- no deploy, restart, environment-variable change, secret change, database write or other Render mutation was invoked by those read checks;
- no provider credential value was exposed in the returned metadata.

This connector evidence proves provider connectivity, but it remains separate from repository-runtime evidence.

## Render constrained proxy boundary

Because a raw Render provider API key is privileged, the approved Phase 3 runtime boundary is the repository-owned constrained proxy implemented by `RenderReadProxy` and `RenderReadTransport`.

The external client can invoke only the semantic protected GET route `/v1/render/services`. It cannot select the upstream URL, HTTP method or provider authorization header. The upstream provider credential remains backend-only and the client response contains provenance metadata rather than the raw provider payload.

## Current-main Render runtime evidence

Before the current-main refresh, the approved proxy service was explicitly deployed from exact repository commit:

`e4c033cf16e0a1ab50d5b294bef4cd93ffaecb05`

Deployment evidence:
- service: `alpha-agent-orchestrator-render-read-proxy`;
- deploy id: `dep-daldfff40ujc73dkogd0`;
- status: `live`;
- finished at: `2026-09-16T17:54:46.980208Z`.

An authenticated GET was then executed against:

`https://alpha-agent-orchestrator-render-read.onrender.com/v1/render/services`

Evidence:
- source: `render`;
- target id: `render:api.render.com/v1/services?ownerId=tea-da5lqvuk1f9s73918ul0&limit=20`;
- observed URL: `https://api.render.com/v1/services?ownerId=tea-da5lqvuk1f9s73918ul0&limit=20`;
- HTTP status: `200`;
- observed at: `2026-09-16T18:06:46.267724+00:00`;
- body digest: `dcdb4fde9b33745985f3123d410dd7c30eeb65ab20d2075d87735d549b1cc96e`;
- body size: `14251`;
- freshness result: `FRESH`;
- collector: `alpha_orchestrator.read_plane.ReadBroker`;
- transport: `alpha_orchestrator.connectors.render_http_transport.RenderReadTransport`;
- verification state: `READ_VALIDATED`;
- service count: `12`;
- `write_capability_exposed: false`.

No provider credential was returned. The validation read itself performed no deploy, restart, environment-variable mutation, secret mutation, database write or other provider mutation.

## Phase-3 status

CONFIRMED:
- GitHub repository runtime read path has current-main real runtime evidence;
- Render repository runtime read path has current-main real runtime evidence through the approved constrained proxy boundary;
- both current-main evidence records include source/target identity, observed URL, observation time, digest/size, freshness result, collector/transport provenance and verification state;
- credentialed redirect handling is fail-closed and regression covered;
- read credentials remain backend-owned;
- the approved read surfaces expose no caller-reachable mutation capability;
- `docs/UI_CONTRACT_BASELINE.md` maps the authoritative backend concepts required before Phase 4.

Phase 3 is therefore **COMPLETE** for the validated real-read scope.

This completion does not enable writer credentials, production approval capabilities, provider mutation or any Phase 5 write behavior.

## Activation boundary carried forward

Real credentials must not be committed. Provider access remains constrained to the approved read-only surface unless a later roadmap phase explicitly passes its own write gates.

## Prohibited by the completed Phase-3 boundary

- commits, PR mutations or workflow dispatches through the runtime read plane;
- Render deploy/restart/env/secret changes through the runtime read plane;
- database writes;
- generic shell or generic HTTP mutation access;
- writer credentials in read-only paths;
- production approval capabilities in read-only paths.
