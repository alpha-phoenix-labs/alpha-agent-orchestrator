# Phase 5 Technical Exit Gate - 2026-09-18

Status: **TECHNICAL EXIT EVIDENCE COMPLETE - WAITING FOR HUMAN PHASE-5 EXIT**  
Mode: **DEVELOPMENT ONLY**  
Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Branch: `phase5/sandbox-human-gate`  
Stacked PR: #36 -> `phase4/premium-mission-control-remediation`  
Technical-evidence HEAD before this record: `cb9052fafa629e6904fc539b19b870f75e5328cd`

## 1. Scope completed

Phase 5 now contains a controlled local-Git sandbox writer and Human-Gated control surface with backend-owned authority for:

- exact Work Order binding;
- Base SHA and State Version binding;
- Plan Hash and Risk binding;
- user-only approval authority;
- exact-target lock;
- policy gate;
- single-use capability;
- temporary scoped internal sandbox credential;
- one bounded sandbox write;
- mandatory Post Write Verification;
- Audit relationship;
- non-secret capability metadata;
- approval, execution and Post Verify view contracts;
- Human-Gated frontend UX that renders backend contracts rather than deriving authority.

The normal Operations Console remains non-operative for Phase-5 writes unless the explicit development feature gate and URL opt-in are both present.

## 2. Human Gate behavior

The approval API rejects a generic YES action. The exact backend binding and exact confirmation phrase are required.

Approval phrase:

`APPROVE <order_id>`

Execution is a separate explicit step and requires:

`EXECUTE <order_id>`

The frontend keeps the development bearer credential in memory only and displays no raw sandbox credential, raw capability token or approval nonce.

## 3. Controlled sandbox target

The Phase-5 real-write target is a repository-owned logical sandbox target backed by a local Git repository constrained beneath an explicitly configured temporary sandbox root.

It is not:

- GitHub remote write;
- Render write;
- production write;
- deployment;
- secret/configuration mutation.

The executor only creates the bounded proof artifact `.alpha-phase5-sandbox-proof.json` and one local sandbox commit.

## 4. UI authority boundary

Backend contracts added:

- APPROVAL;
- CAPABILITY;
- EXECUTION;
- POST_VERIFY.

The frontend displays their supplied fields only.

The UI does not:

- calculate approval validity;
- mint capability;
- issue sandbox credential;
- acquire or release lock;
- decide policy;
- infer write eligibility;
- verify Post Write results independently;
- expose raw capability/credential material.

The Phase-5 panel is disabled by default and requires both:

- build-time `VITE_ENABLE_PHASE5_SANDBOX_CONTROL=true`;
- URL opt-in `sandboxControl=phase5`.

## 5. Automated validation on technical-evidence HEAD

### control-plane-ci #267

Result: **SUCCESS**

Backend/security suite:

- **180 passed**;
- Phase-5 deterministic gate preparation SUCCESS;
- Phase-2 no-execution regression SUCCESS.

Frontend:

- unit/integration tests SUCCESS;
- production build/typecheck SUCCESS.

### full-system-validation #189

Result: **SUCCESS**

- backend-validation SUCCESS;
- frontend-validation SUCCESS;
- read-only-runtime-smoke SUCCESS;
- operations-preview-external-smoke SUCCESS;
- browser-e2e SUCCESS.

Backend branch coverage report:

- TOTAL coverage: **92%**;
- dependency audit: **No known vulnerabilities found**.

Browser E2E:

- **29 passed**;
- isolated Phase-5 control backend started successfully;
- isolated feature-enabled Phase-5 frontend started successfully;
- browser flow verified exact approval phrase;
- generic YES remains insufficient;
- separate exact execution phrase verified;
- backend returned Capability CONSUMED;
- backend returned Execution COMPLETED;
- backend returned Post Verify PASSED / POST_VERIFY_PASS;
- no localStorage, sessionStorage or cookie persistence was introduced for the control token.

## 6. Phase-5 roadmap exit criteria mapping

The implemented and validated control path covers:

`PLAN -> HUMAN_GATE -> EXECUTE -> POST_VERIFY -> CLOSE`

Evidence exists for:

- user-only Human Gate enforcement in backend;
- explicit prior user authorization for the first controlled isolated sandbox proof;
- backend approval validation;
- temporary scoped sandbox credential;
- exact target binding;
- resource lock;
- single-use capability;
- mandatory Post Verify;
- complete Audit chain relationship;
- UI presentation of real backend approval/capability/execution/Post Verify state;
- default-disabled write UX outside the explicit development opt-in.

No Phase-6 adversarial scope has been started.

## 7. Known boundary

No external Phase-5 deployment was required by the Phase-5 exit criteria and none was performed.

The existing Render Operations preview remains the Phase-4 read-only preview and is not repurposed into a write-capable service.

Phase 5 is therefore **technically ready for Human Exit review**, not automatically closed.

## 8. Human Gate

The next action is a Human Phase-5 Exit decision.

Approval of this gate means:

- accept Phase-5 technical exit evidence;
- close Phase 5;
- permit preparation of Phase 6 ADVERSARIAL work under a new revalidated baseline.

It does **not** mean:

- merge PR #36;
- deploy Phase-5 control service;
- enable production writes;
- enter LIVE_GATED;
- bypass Phase-6 adversarial validation.

Until explicit Human Phase-5 Exit approval, Phase 6 remains blocked.
