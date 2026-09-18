# Phase 5 Entry to Human Gate - 2026-09-18

Status: **IMPLEMENTATION IN PROGRESS - STOP BEFORE FIRST CONTROLLED SANDBOX RUNTIME APPROVAL**  
Mode: **DEVELOPMENT ONLY**  
Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Phase-4 handoff baseline: `5e73e121d0829b28add9c483a06f3da4617d9f2a`  
Phase-5 branch: `phase5/sandbox-human-gate`  
Stacked PR: #36 -> base `phase4/premium-mission-control-remediation`

## 1. Baseline evidence

Before the first Phase-5 write:

- Phase-4 final HEAD was re-confirmed at `5e73e121d0829b28add9c483a06f3da4617d9f2a`.
- `control-plane-ci #248` and `full-system-validation #170` were confirmed successful on that Phase-4 closure HEAD.
- PR #35 remained open, draft and unmerged.
- a new isolated Phase-5 branch was created directly from the Phase-4 closure HEAD.
- Render was inspected read-only.
- no dedicated Agent-Swarm Phase-5 sandbox service exists on Render.
- existing sandbox/runtime services belonging to other products were not reused.
- no Render resource, environment variable, credential or deployment was changed.

## 2. Root cause / smallest missing Phase-5 gap

**CONFIRMED:** the existing control plane already contained:

- `SystemMode.SANDBOX_WRITE`;
- user-only `ApprovalAuthority`;
- single-use approval -> capability issuance;
- exact Work Order target binding;
- exact-target resource locks;
- stale-state checks;
- writer-role scope checks;
- replay/idempotency controls;
- Emergency Freeze;
- hash-chained Audit;
- mock-only end-to-end execution and post-write behavior.

The smallest missing backend/runtime gap was that the final WriteProxy still exposed only a mock-executor registration path and no isolated real sandbox executor existed.

Phase 5 therefore required a real but non-production write target without weakening existing gates.

## 3. Sandbox target decision

The first Phase-5 write target is intentionally **local and isolated**, not Render and not a production/external repository:

`sandbox-git://phase5-runtime-proof`

Properties:

- backend-owned logical target identity;
- physical repository path must be underneath an explicitly configured sandbox root;
- path escape is rejected;
- target must already be a local Git repository;
- only canonical action `git_commit` is accepted;
- executor writes only one bounded proof artifact:
  `.alpha-phase5-sandbox-proof.json`;
- no arbitrary shell command is accepted;
- Git is invoked with fixed argument arrays and backend-owned working directory;
- no provider network credential is required;
- no external network write occurs.

This is the smallest controlled real-write surface able to prove the Phase-5 Control Plane before any provider write integration is considered.

## 4. Temporary scoped sandbox credential

Phase 5 adds a backend-only temporary sandbox credential authority.

The credential is bound to:

- Work Order ID;
- action;
- exact logical target;
- expiry;
- random opaque token.

Security rules:

- only the token digest is stored by the credential authority;
- raw credential token is never written to Audit;
- a credential is issued only after Human Approval and capability minting;
- it is consumed once by the sandbox executor;
- wrong target/action/order, replay or expiry fails closed;
- UI/telemetry receives no raw token.

This credential is an **internal isolated-sandbox credential**, not a claim of provider-side least-privilege credentials.

## 5. Policy / lock / capability / state chain

The sandbox execution chain remains:

`PLAN -> HUMAN_GATE -> LOCK -> STATE/POLICY -> CAPABILITY -> TEMP_CREDENTIAL -> WRITE_PROXY -> SANDBOX_EXECUTOR -> POST_VERIFY`

Bindings preserved:

- exact target lock = Work Order target;
- policy permits only registered `sandbox-git://` target plus `git_commit`;
- Base SHA is captured before Human Gate;
- Base SHA drift before execution blocks before credential issuance;
- Work Order Base State Version is revalidated;
- approval and capability remain plan-hash/state/target/action bound;
- WriteProxy revalidates mode, writes-enabled state, writer scope, state, lock, capability, replay and execution limit immediately before dispatch.

## 6. Mandatory post-write verification

A sandbox dispatch is not completion.

Post Verify checks:

- proof artifact exists;
- current Git HEAD equals executor-reported commit SHA;
- artifact digest equals executor-reported digest;
- artifact JSON exactly matches:
  - Order ID,
  - action,
  - target,
  - plan hash,
  - base state version,
  - expected effect.

Failure forces the existing Emergency Freeze behavior.

Only successful Post Verify advances the Work Order to DONE.

## 7. Human Gate preparation

`scripts/phase5_sandbox_gate.py` creates a deterministic temporary Git sandbox, prepares the fixed first Phase-5 Work Order and stops at:

`WAITING_FOR_APPROVAL`

The preparation step asserts:

- no proof commit occurred;
- no sandbox credential was issued;
- no capability was minted;
- no write execution Audit event exists.

CI prints the exact approval binding:

- Order ID;
- action;
- target;
- Base SHA;
- State Version;
- Plan Hash;
- Risk;
- Expected Effect.

The first controlled runtime execution must not proceed until the human explicitly approves that exact current binding.

## 8. Validation requirements before presenting Human Gate

Required before asking for execution approval:

1. final Phase-5 branch HEAD confirmed;
2. backend static/import checks pass;
3. full Python test suite passes;
4. Phase-5 sandbox tests pass;
5. deterministic gate-preparation step passes;
6. existing Phase-2 mock no-execution check remains green;
7. frontend validation remains green even though no Phase-5 UI control is added yet;
8. full-system-validation remains green;
9. no deploy occurred;
10. no external provider write occurred.

If a code/document change is required after the approval packet is produced, the packet must be regenerated from the new HEAD before approval.

## 9. Current explicit stop boundary

This implementation does **not** authorize:

- Human Approval;
- sandbox runtime execution outside tests;
- Render deploy;
- provider write;
- protected-branch merge;
- production integration;
- Phase-5 active approval/execution UI;
- Phase-5 closure.

The next stop is the exact Human Gate for the first controlled isolated sandbox runtime proof.
