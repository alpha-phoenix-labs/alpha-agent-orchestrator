# Phase 4 — Full Shadow Mode

Status: **PHASE 4.1 PATCH IN PROGRESS — NO WRITE EXECUTION**

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

## Phase 4.1 acceptance evidence

Patch/CI acceptance requires:

- unit coverage for `REQUEST -> READ -> VERIFY -> FINDING -> PLAN`;
- multiple read steps can be bound into one plan;
- disputed/invalid Independent Review fails closed;
- no-read tasks fail closed before transport use;
- capabilities remain `0`;
- external writes remain `0`;
- existing Phase-1/2/3 security regressions remain green.

Runtime acceptance remains separate from CI: at least one approved real Shadow task must later execute this request-to-plan path against a real read-only source while still producing zero capabilities and zero external writes.

## Phase ordering

After Phase 4.1 is runtime-evidenced, the frozen roadmap proceeds to **Phase 4.2 — Authoritative read models / view contracts**. Frontend stack selection remains Phase 4.3 and must not be pulled forward.
