# Phase 4 — Full Shadow Mode

Status: **PHASE 4.1 RUNTIME VERIFIED — NO WRITE EXECUTION**

Phase 4 validates the complete decision path while preserving a hard no-write invariant. The frozen roadmap requires the Shadow core before authoritative UI read models and before frontend-stack selection.

## Phase 4.1 — Shadow core first

The Phase-4.1 target path is:

`REQUEST -> READ -> VERIFY -> FINDING -> PLAN`

Required behavior:

1. A Shadow task contains one or more explicit read steps.
2. Real read-only observations are collected through `ReadBroker` / `ShadowReadService`.
3. Fresh provenance-backed observations become `ShadowFinding` records.
4. An explicit independent reviewer evaluates the complete finding set.
5. `ShadowWorkflow` revalidates Evidence/provenance and creates an exact plan hash plus proposed writer.
6. The resulting writer is proposal metadata only; no capability is minted and no writer/executor is invoked.

`ShadowTaskRunner` is the request-to-plan coordinator for this boundary. It deliberately exposes no acknowledgement, capability-minting, `WriteProxy`, writer dispatch or executor surface.

## Existing optional Shadow simulation scaffold

The repository also contains acknowledgement/simulation helpers in `ShadowWorkflow`. Those helpers model later steps without executing a write. They are not required to prove the Phase-4.1 request-to-plan path and do not convert a Shadow acknowledgement into an approval or capability.

## Invariants

- `SYSTEM_MODE=SHADOW`
- `WRITES_ENABLED=false`
- `CAPABILITIES_ISSUED=0`
- `EXTERNAL_WRITES_PERFORMED=0`
- Unknown actions/readers fail closed.
- Empty real-read task definitions fail closed.
- Independent Review must be explicit and boolean.
- Disputed Independent Review blocks plan creation.
- Evidence/provenance is revalidated before a plan exists.
- Stale, future-dated or invalid provenance fails closed.
- Proposed writers are inert plan metadata.
- Shadow task orchestration imports/invokes neither `ApprovalAuthority` nor `WriteProxy`.

## Phase 4.1 patch / CI evidence

PR #15 implemented the integrated Shadow request-to-plan core from exact base `main@0891f0cd6a5ac1e717264e31736522a497383c9a`.

Merged main commit:

`836a89cf808156f8fe12d621fad618f8ca372ea9`

Pre-merge PR CI:

- workflow run: `35134463337`;
- job: `104923238511`;
- result: `SUCCESS`;
- tests: `100 passed in 0.38s`.

Post-merge CI:

- workflow run: `35134670097`;
- event: push to `main`;
- head SHA: `836a89cf808156f8fe12d621fad618f8ca372ea9`;
- result: `SUCCESS`.

## Phase 4.1 real Shadow runtime evidence

A one-time validation branch was created from exact current main `836a89cf808156f8fe12d621fad618f8ca372ea9`. The validation workflow used GitHub Actions with `Contents: read` and `Metadata: read`, `persist-credentials: false`, `SYSTEM_MODE=SHADOW` and `WRITES_ENABLED=false`.

Runtime execution:

- validation branch commit: `f04fcaeccc01366ba12584e63cd388863fc5f252`;
- workflow run: `35134845854`;
- job: `104924525906`;
- result: `SUCCESS`;
- source: `github`;
- target id: `github:api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`;
- HTTP status: `200`;
- observed at: `2026-09-16T18:30:48.958270+00:00`;
- body digest: `d8d506d7525cfc4de5b15fcc72e669839ba00e2b8aa7398349ff688f8699f0a7`;
- body size: `7731`;
- freshness: `FRESH`;
- collector: `alpha_orchestrator.read_plane.ReadBroker`;
- transport: `alpha_orchestrator.connectors.github_http_transport.GitHubReadTransport`;
- verification state: `READ_VALIDATED`;
- finding count: `1`;
- evidence count: `1`;
- Independent Review confirmed: `true`;
- proposed writer: `code_writer` as inert plan metadata only;
- plan simulation-only: `true`;
- capabilities issued: `0`;
- external writes performed: `0`.

The runtime path reported:

`REQUEST -> READ -> VERIFY -> FINDING -> PLAN`

The temporary workflow file was removed after the run. The validation branch then had no file diff against the validated main baseline.

## Phase ordering

Phase 4.1 is runtime-verified. The frozen roadmap now proceeds to **Phase 4.2 — Authoritative read models / view contracts**. Frontend stack selection remains Phase 4.3 and must not be pulled forward.
