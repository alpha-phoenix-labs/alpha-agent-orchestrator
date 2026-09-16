# Phase 4.1 Roadmap Amendment — Shadow Core runtime evidence

Status: **APPROVED STATUS/TRACEABILITY AMENDMENT — NO PHASE REORDERING**  
Applies to: `docs/INTEGRATED_ROADMAP.md`  
Base roadmap status: frozen/binding  
Validated implementation baseline: `main@836a89cf808156f8fe12d621fad618f8ca372ea9`

## 1. Reason

The frozen roadmap requires Phase 4.1 — Shadow core first — before Phase 4.2 authoritative read models and before Phase 4.3 frontend-stack selection.

PR #15 implemented the integrated request-to-plan boundary. A separate real runtime validation then demonstrated the required Shadow path against a real GitHub read-only source while preserving the hard no-write invariants.

This amendment records status/evidence only. It does not change, weaken, remove or reorder any roadmap gate.

## 2. Implementation evidence

PR #15: `Phase 4.1 shadow request-to-plan core`

- base before merge: `main@0891f0cd6a5ac1e717264e31736522a497383c9a`;
- reviewed PR head: `fe95a7ae4a88f4209e7467176aeb09a327e1a085`;
- squash merge / main commit: `836a89cf808156f8fe12d621fad618f8ca372ea9`;
- changed files: `3`;
- pre-merge CI run: `35134463337`;
- pre-merge job: `104923238511`;
- tests: `100 passed in 0.38s`;
- post-merge CI run: `35134670097`;
- post-merge conclusion: `SUCCESS`.

Implementation boundary:

`REQUEST -> READ -> VERIFY -> FINDING -> PLAN`

The coordinator exposes no approval, capability minting, `WriteProxy`, writer-dispatch or executor surface.

## 3. Real Shadow runtime evidence

The one-time validation branch was based on exact current main `836a89cf808156f8fe12d621fad618f8ca372ea9`.

Runtime evidence:

- validation commit: `f04fcaeccc01366ba12584e63cd388863fc5f252`;
- workflow run: `35134845854`;
- job: `104924525906`;
- result: `SUCCESS`;
- runner credential permissions: `Contents: read`, `Metadata: read`;
- checkout: `persist-credentials: false`;
- `SYSTEM_MODE=SHADOW`;
- `WRITES_ENABLED=false`;
- source: `github`;
- target id: `github:api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`;
- HTTP status: `200`;
- observed at: `2026-09-16T18:30:48.958270+00:00`;
- body digest: `d8d506d7525cfc4de5b15fcc72e669839ba00e2b8aa7398349ff688f8699f0a7`;
- body size: `7731`;
- freshness result: `FRESH`;
- collector: `alpha_orchestrator.read_plane.ReadBroker`;
- transport: `alpha_orchestrator.connectors.github_http_transport.GitHubReadTransport`;
- verification state: `READ_VALIDATED`;
- findings: `1`;
- Evidence records in plan: `1`;
- Independent Review confirmed: `true`;
- proposed writer: `code_writer` as inert plan metadata only;
- simulation-only plan: `true`;
- capabilities issued: `0`;
- external writes performed: `0`.

The temporary workflow was removed after the run. The cleanup commit is `79ac62b11a63a3f09f95c71d6d3ef491c2763139`, and comparison against `main@836a89cf808156f8fe12d621fad618f8ca372ea9` shows no remaining file diff.

No credential value was emitted. No repository write was performed by the Shadow runtime path itself.

## 4. Phase 4.1 gate result

Against the frozen-roadmap Phase 4.1 requirements:

- real task: **PASS**;
- real reader: **PASS**;
- real Evidence: **PASS**;
- real verification: **PASS**;
- Finding: **PASS**;
- Plan: **PASS**;
- explicit Independent Review: **PASS**;
- proposed write represented only as plan metadata: **PASS**;
- write execution: **ZERO / PASS**.

Effective Phase 4.1 status: **RUNTIME VERIFIED**.

## 5. Execution pointer

The current execution pointer after merge of this traceability amendment is:

**Phase 4.2 — Authoritative read models / view contracts**

Phase 4.3 frontend-stack selection remains later and must not be pulled forward.
