# Phase 1 Completion Record — OFFLINE

Status: **COMPLETE / MERGED / NOT DEPLOYED**  
Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Phase-1 final baseline on `main`: `e4384ccd745e38ba33d4db2498863f510e3614bf`  
Recorded: 2026-09-16

This document is the completion record for Phase 1 and the user-directed hardening gate inserted before Phase 2. It is evidence-oriented: statements are tied to repository paths, immutable commit/PR/run identifiers, or an explicit UNKNOWN/NOT INSPECTED marker.

> Terminology: in this document, **IP** means **Implementation Point** and is only a local traceability identifier (`IP-01`, `IP-02`, ...). The repository had no prior canonical expansion of the abbreviation `IP`.

## 1. Phase-1 acceptance boundary

`docs/GO_LIVE_GATES.md` defines Phase 1 — OFFLINE as:

- deterministic core tests pass;
- no credentials;
- no network writes.

A user-directed pre-Phase-2 hardening gate was added after Phase-1 review and before Phase 2. The gate requires eight additional controls to be enforced and regression-tested before Phase 2 starts. These are documented in Section 7.

Phase 1 does **not** require a runtime or production deployment. The repository remains DEVELOPMENT/OFFLINE. No production deployment is claimed by this record.

## 2. Final baseline

| Item | Final Phase-1 evidence |
|---|---|
| Repository | `alpha-phoenix-labs/alpha-agent-orchestrator` |
| Protected branch | `main` |
| Final Phase-1 / pre-P2 HEAD | `e4384ccd745e38ba33d4db2498863f510e3614bf` |
| Bootstrap PR | PR #1, merged |
| Bootstrap merge commit | `d1d084e9cd71259a6c1e28e4fcea33626c2b9143` |
| Pre-P2 hardening PR | PR #2, merged |
| Pre-P2 hardening merge commit | `e4384ccd745e38ba33d4db2498863f510e3614bf` |
| Default control-plane mode | `OFFLINE` |
| Writes default | `false` |
| Human authority | `USER_ONLY` |
| Post-merge CI | Run `35085237167`, SUCCESS |
| Post-merge CI job | `104758394087`, SUCCESS |
| Post-merge tests | `59 passed` |
| Production deployment | **NONE / NOT PERFORMED** |

Stable evidence links:

- PR #1: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/pull/1
- Bootstrap merge: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/commit/d1d084e9cd71259a6c1e28e4fcea33626c2b9143
- PR #2: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/pull/2
- Final Phase-1 commit: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/commit/e4384ccd745e38ba33d4db2498863f510e3614bf
- Bootstrap CI run: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/actions/runs/35080870832
- Final post-merge CI run: https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/actions/runs/35085237167

## 3. Architecture delivered in Phase 1

The repository establishes a zero-trust hub-and-spoke control-plane architecture:

`USER -> LEADER -> deterministic router/readers -> verification -> deterministic control plane -> USER_ONLY human gate -> short-lived capability -> scoped writer -> WriteProxy -> target -> post-write verification -> audit`.

The architecture explicitly states that the Leader has no direct write capability and that the orchestrator starts in `OFFLINE` mode. See `ARCHITECTURE.md`.

### Agent-role scaffold

The final tree contains:

- one Leader role: `agents/leader.md`;
- ten read-only specialist roles:
  - `api_contract_reader`
  - `ci_pipeline_reader`
  - `database_reader`
  - `dependency_supply_chain_reader`
  - `github_branch_reader`
  - `observability_reader`
  - `render_service_reader`
  - `runtime_reader`
  - `security_reader`
  - `visual_pipeline_reader`;
- three verifier roles:
  - `evidence_verifier`
  - `independent_reviewer`
  - `post_write_verifier`;
- two writer roles:
  - `code_writer`
  - `infra_writer`.

The communication contract in `config/control_contract.yaml` permits Leader<->Reader and Leader<->Writer communication while denying Reader<->Writer, Reader<->Reader, and Writer<->Writer communication.

## 4. Security invariants delivered

`SECURITY.md` defines the core invariant: **no single AI agent can cause a real system change**.

The declared write path requires verified evidence, independent review, fresh state, collision-free resource locking, policy/scope checks, exact human approval, short-lived capability, scoped writer, deterministic WriteProxy validation and independent post-write verification.

`config/control_contract.yaml` additionally encodes fail-closed rules including:

- unknown means deny;
- stale means deny;
- disputed means deny;
- no evidence means deny;
- no lock means deny;
- no exact human approval means deny;
- plan change invalidates approval;
- state change invalidates approval;
- emergency freeze overrides all;
- external content is untrusted data.

`config/policies.yaml` requires the human gate for LOW, MEDIUM, HIGH and CRITICAL risk classes and requires post-write verification, resource lock, exact plan hash and fresh state for production-oriented policy evaluation.

## 5. Deterministic control-plane implementation

Phase 1 contains executable control-plane components under `src/alpha_orchestrator/`, including state, locks, approvals/capabilities, guards, WriteProxy, audit, mock workflow, read-plane preparation and shadow simulation.

Key boundaries at the final Phase-1 HEAD:

- `StateStore` is thread-safe and produces a deterministic state-version hash.
- `ResourceLockManager` provides atomic in-process resource locking for the current scaffold.
- `ApprovalAuthority` requires `USER_ONLY`, binds approval to order/action/target/plan hash/base-state version, is synchronized, permits one approval per order and makes approval single-use for capability minting.
- `Capability` carries the approved `base_state_version`.
- `WriteProxy` is the final deterministic choke point and revalidates mode, writes-enabled status, state freshness and the exact target lock immediately before dispatch.
- `WriteProxy` enforces canonical writer scopes, capability binding, expiry, capability replay protection, execution-id replay protection and maximum executions per order.
- `AuditLog` is append-only and hash-chained in the Phase-1 in-memory scaffold.

The current StateStore, locks and audit store are in-memory Phase-1 implementations. They are **not** represented here as durable production persistence.

## 6. OFFLINE and credential/write boundaries

The tracked defaults remain:

- `ALPHA_SYSTEM_MODE=OFFLINE`
- `ALPHA_WRITES_ENABLED=false`
- `ALPHA_HUMAN_APPROVER_ID=USER_ONLY`
- `ALPHA_MAX_EXECUTIONS_PER_ORDER=1`

The GitHub Actions workflow runs tests with `ALPHA_SYSTEM_MODE=OFFLINE` and `ALPHA_WRITES_ENABLED=false`, and the workflow declares `permissions: contents: read`.

The tracked repository does not contain production credential values. The current read-plane configuration specifies backend-transport-only credential visibility and denies caller-supplied credentials.

**Evidence limitation:** GitHub repository/environment secret stores are **NOT INSPECTED / NOT AVAILABLE through the connected evidence interface**. Therefore this record does not claim that no dormant secret objects exist in GitHub settings; it claims that Phase-1 tracked code/configuration and the verified CI path do not expose or require production credentials.

No live GitHub writer, Render deployer, secret mutation, database write or production runtime deployment is part of the Phase-1 completion claim.

## 7. User-directed pre-Phase-2 hardening gate

A security review after the initial bootstrap identified eight gaps. The user directed that all eight be completed before Phase 2. This was an explicit roadmap insertion and is documented in `docs/GO_LIVE_GATES.md`.

### IP-01 — WriteProxy runtime revalidation

**Problem:** direct WriteProxy use could bypass upstream mode/state/lock checks.

**Implemented:** WriteProxy now revalidates blocked modes, `writes_enabled`, current state and exact target lock immediately before executor dispatch.

**Evidence:**
- `src/alpha_orchestrator/write_proxy.py`
- regression: direct proxy execution in OFFLINE is denied
- PR #2 / final commit `e4384ccd...`

### IP-02 — Capability bound to base-state version

**Problem:** state change after capability mint was not independently visible to the proxy.

**Implemented:** `Capability` now carries `base_state_version`; WriteProxy checks it against the WorkOrder and current state.

**Evidence:**
- `src/alpha_orchestrator/approvals.py`
- `src/alpha_orchestrator/write_proxy.py`
- regression: state change after capability mint is denied as stale

### IP-03 — One approval / maximum one execution per order

**Problem:** multiple approvals for the same WorkOrder and repeated execution paths were possible.

**Implemented:** synchronized one-approval-per-order guard plus `max_executions_per_order` enforcement in WriteProxy.

**Evidence:**
- `src/alpha_orchestrator/approvals.py`
- `src/alpha_orchestrator/write_proxy.py`
- `ALPHA_MAX_EXECUTIONS_PER_ORDER=1`
- regressions for second approval and execution limit

### IP-04 — Lock bound to exact WorkOrder target

**Problem:** a caller-selected lock identifier could differ from the WorkOrder target.

**Implemented:** pre-execution and proxy checks derive the lock identity from `order.target`; the mock execution path acquires that exact target.

**Evidence:**
- `src/alpha_orchestrator/guards.py`
- `src/alpha_orchestrator/mock_workflow.py`
- `src/alpha_orchestrator/write_proxy.py`
- regressions for wrong/missing target lock

### IP-05 — Explicit independent review in Shadow

**Problem:** Shadow planning defaulted independent-review confirmation to `True`.

**Implemented:** `independent_review_confirmed` is now required explicitly; omitted or disputed review fails closed.

**Evidence:**
- `src/alpha_orchestrator/shadow_workflow.py`
- `tests/test_shadow_workflow.py`

### IP-06 — Canonical action schema

**Problem:** Shadow, WriteProxy and resource-scope configuration used divergent action names.

**Implemented:** canonical action sets are centralized in `src/alpha_orchestrator/actions.py` and aligned with `config/resource_scopes.yaml`.

Canonical code actions:
- `git_commit`
- `git_branch`
- `pull_request`
- `merge`

Canonical infra actions:
- `render_deploy`
- `approved_runtime_config`

`db_migration` is not in the canonical allowed infra action set.

### IP-07 — Backend-only credential boundary

**Problem:** ReadBroker/ShadowReadService exposed caller-supplied headers.

**Implemented:** callers can no longer provide request headers; authentication belongs to the injected backend transport.

**Evidence:**
- `src/alpha_orchestrator/read_plane.py`
- `src/alpha_orchestrator/shadow_read.py`
- `config/read_sources.yaml`
- regression verifies caller-supplied headers are rejected

### IP-08 — Explicit GitHub repository allowlist

**Problem:** GitHub read scope was based on the broad `/repos/` prefix.

**Implemented:** `github_policy()` requires at least one explicit `owner/repo` identifier and creates exact repository path prefixes with boundary-safe matching.

Current configured repository allowlist:
- `alpha-phoenix-labs/alpha-agent-orchestrator`

**Evidence:**
- `src/alpha_orchestrator/connectors/github_read.py`
- `config/read_sources.yaml`
- regressions for unallowlisted repository and prefix-collision denial

## 8. Read-plane and Shadow scaffold status

The repository already contains preparation for later phases. This preparation does **not** mean Phase 3 or Phase 4 has been activated.

Read-plane preparation includes HTTPS-only, allowlisted host/path policy, GET-style transport interface, response-size limits, non-2xx/non-JSON failure handling, provenance fields and backend-only authentication boundary.

Shadow workflow preparation has a hard no-write invariant, performs plan acknowledgement/simulation only and reports zero capabilities/external writes.

Roadmap status at the end of this record:

- Phase 1 — OFFLINE: **COMPLETE**
- User-directed pre-P2 hardening: **COMPLETE**
- Phase 2 — MOCK: **NOT STARTED by this completion record**
- Phase 3 — REAL READ-ONLY: not activated
- Phase 4 — SHADOW: not activated as a real-task phase
- Phase 5 — SANDBOX WRITE: not activated
- Phase 6 — ADVERSARIAL ACCEPTANCE: not activated
- Phase 7 — LIVE_GATED: not activated

## 9. CI and test evidence

### Bootstrap evidence

PR #1 (`Bootstrap zero-trust control plane v0.4`) merged the isolated bootstrap.

- PR head: `070d0db2a51322128224ac9a5e63bcc221e4029b`
- merge commit: `d1d084e9cd71259a6c1e28e4fcea33626c2b9143`
- changed files: 65
- additions/deletions: +2483 / -7
- bootstrap CI run: `35080870832`
- workflow: `control-plane-ci`
- conclusion: SUCCESS
- bootstrap test result at that boundary: `47 passed`

### Hardening evidence

PR #2 (`Pre-Phase 2 security hardening (issues 1–8)`) merged the eight hardening items.

- PR head: `9ae78f013b573601b2d4ccbb4fd78639b0259c7c`
- merge/final Phase-1 commit: `e4384ccd745e38ba33d4db2498863f510e3614bf`
- changed files: 19
- additions/deletions: +453 / -178

Final post-merge CI:

- run ID: `35085237167`
- event: push to `main`
- job ID: `104758394087`
- Python: 3.12.14
- environment: `ALPHA_SYSTEM_MODE=OFFLINE`, `ALPHA_WRITES_ENABLED=false`
- GITHUB_TOKEN runtime permissions shown by the runner: Contents read / Metadata read
- result: **59 passed in 0.17s**
- conclusion: **SUCCESS**

The Node.js action deprecation messages in the CI log are warnings; they did not fail the run.

## 10. Repository protection evidence

Ruleset `protect-main` (ID `23537103`) is active on the default branch.

Confirmed controls:

- branch deletion restricted;
- non-fast-forward/force-push restricted;
- pull-request rule active;
- allowed merge method: squash;
- required status check: `test`;
- strict required-status-check policy enabled;
- bypass actors: none;
- current connected user cannot bypass the ruleset.

Ruleset evidence:
https://github.com/alpha-phoenix-labs/alpha-agent-orchestrator/rules/23537103

## 11. IP & Evidence ledger

| IP | Implementation point | Primary code/config evidence | Test/CI evidence | Status |
|---|---|---|---|---|
| IP-01 | WriteProxy final runtime revalidation | `write_proxy.py` | targeted regression + 59-pass CI | CONFIRMED |
| IP-02 | capability/state binding | `approvals.py`, `write_proxy.py` | stale-after-mint regression | CONFIRMED |
| IP-03 | one approval / one execution | `approvals.py`, `write_proxy.py` | duplicate approval/execution regressions | CONFIRMED |
| IP-04 | exact target lock binding | `guards.py`, `mock_workflow.py`, `write_proxy.py` | wrong-lock regression | CONFIRMED |
| IP-05 | explicit independent review | `shadow_workflow.py` | omitted/disputed review regressions | CONFIRMED |
| IP-06 | canonical action schema | `actions.py`, `resource_scopes.yaml` | cross-component schema regression | CONFIRMED |
| IP-07 | backend-only read credentials | `read_plane.py`, `shadow_read.py`, `read_sources.yaml` | caller-header denial regression | CONFIRMED |
| IP-08 | explicit GitHub repo allowlist | `github_read.py`, `read_sources.yaml` | repo/prefix-collision regressions | CONFIRMED |
| IP-09 | USER_ONLY human authority | `control_contract.yaml`, `approvals.py` | approval tests | CONFIRMED |
| IP-10 | OFFLINE/writes-disabled defaults | `.env.example`, `control_contract.yaml`, CI env | final CI run | CONFIRMED |
| IP-11 | role separation / hub-spoke | `ARCHITECTURE.md`, `agents/`, `control_contract.yaml` | structural/config evidence | CONFIRMED |
| IP-12 | hash-chained audit scaffold | `events.py` | audit-chain tests | CONFIRMED |
| IP-13 | protected `main` | ruleset `23537103` | required `test` check | CONFIRMED |
| IP-14 | production deploy absent in P1 | roadmap + repository/CI scope | no deploy job/action in Phase-1 CI | CONFIRMED for Phase-1 workflow; external deployment systems NOT INSPECTED |

## 12. Known limits and explicit non-claims

The following are deliberately outside the Phase-1 completion claim:

- no production deployment;
- no live production writer;
- no production GitHub/Render mutation integration;
- no claim of durable transactional StateStore/locks/audit persistence;
- no Phase-3 credential activation;
- no real-task Shadow activation;
- no sandbox write acceptance;
- no adversarial acceptance completion;
- no LIVE_GATED activation.

External provider state not represented by GitHub repository/runtime evidence is **NOT INSPECTED** unless separately recorded by a later phase.

## 13. Completion decision

**Phase 1 is complete.** The bootstrap and the user-directed eight-item hardening gate are merged into protected `main`, and final post-merge CI is green with 59 tests passing. The system remains fail-closed in DEVELOPMENT/OFFLINE state and has not been deployed to a production runtime.

The next roadmap step after this record is **Phase 2 — MOCK**, whose acceptance requires mock GitHub/Render targets and collision, stale-state, replay and scope tests to pass.
