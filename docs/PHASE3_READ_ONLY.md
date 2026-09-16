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

## GitHub real-read runtime evidence

The user explicitly approved the GitHub real-read gate. A one-time validation workflow was executed from branch `phase3/real-read-validation` and then removed from the persistent repository state.

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

GitHub REAL READ-ONLY is **RUNTIME VERIFIED for the validated GitHub path only**.

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
- service listing returned 11 Render services;
- Postgres listing returned 3 instances;
- a representative deploy-history read for service `alpha-creator-sandbox` (`srv-daf7u6v40ujc73a22lg0`) returned recent deploy metadata;
- the newest returned deploy was `dep-dal541lg1s2s73e9e1h0`, status `live`, commit `3a7c51c3ed316874ed8ad5cf1db705846151e3b3`, finished at `2026-09-16T08:24:24.85783Z`;
- no deploy, restart, environment-variable change, secret change, database write or other Render mutation was invoked;
- no provider credential value was exposed in the returned metadata.

This live connector evidence proves current provider connectivity and readable metadata for the approved workspace. It does **not** prove that the underlying Render account/API credential is intrinsically non-mutating, and it is not the same execution path as `RenderReadTransport` inside this repository.

## Render real-read smoke

`scripts/phase3_render_real_read.py` is the repository-runtime acceptance smoke. It performs one authenticated GET to the Render services list scoped by `ALPHA_RENDER_WORKSPACE_ID`, checks 2xx JSON plus freshness <= 60 seconds, and prints provenance metadata only.

The smoke must not be executed until a backend-only credential or equivalent constrained proxy is explicitly approved for this runtime path.

## Phase-3 status

CONFIRMED:
- GitHub repository runtime read path is live and runtime-verified;
- Render provider connectivity is live-read verified through the approved connected Render reader;
- Render runtime policy is constrained to explicit non-secret metadata URL templates;
- Render backend transport is GET-only by construction and has no caller method/header injection surface once tests pass.

NOT YET VERIFIED:
- `RenderReadTransport` performing a real authenticated Render API request with a backend credential/proxy;
- provider-side non-mutation of a raw Render API key independent of the constrained transport boundary;
- Phase 3 completion across the repository runtime path for Render.

Phase 3 therefore remains **OPEN** until the repository `RenderReadTransport` real-read smoke is executed successfully through an approved backend-only credential/proxy and its provenance/freshness evidence is captured.

## Activation gate

Real credentials must not be committed. Provider access used for Phase 3 must be technically non-mutating at the exposed runtime surface. If provider permissions cannot be made technically read-only, use a constrained proxy/connector that exposes only approved GET operations.

## Prohibited in Phase 3

- commits, PR mutations or workflow dispatches through the runtime read plane;
- Render deploy/restart/env/secret changes;
- database writes;
- generic shell or generic HTTP mutation access;
- writer credentials;
- production approval capabilities.
