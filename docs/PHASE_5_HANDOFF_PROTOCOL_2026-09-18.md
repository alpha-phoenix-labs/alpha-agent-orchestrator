# Phase 5 Handoff Protocol - 2026-09-18

Status: **PHASE 5 HANDOFF PREPARED - IMPLEMENTATION NOT STARTED**  
Predecessor: Phase 4 SHADOW + READ-ONLY OPERATIONS CONSOLE - Human Exit approved 2026-09-18.  
Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Branch at handoff preparation: `phase4/premium-mission-control-remediation`

This protocol prepares the controlled transition into Frozen Roadmap Phase 5. It does not itself execute a sandbox write, deploy a service, merge PR #35, change provider credentials, create infrastructure or enable production behavior.

## 1. Phase 5 roadmap objective

Frozen Roadmap Phase 5 is:

**SANDBOX WRITE + HUMAN-GATED CONTROL UX**

Goal:

Enable the first real write-capable workflow **only inside a controlled sandbox** and expose that workflow through Human-Gated UI backed directly by real Control Plane contracts.

Phase 5 is not production write authorization.

## 2. Authority inherited from Phase 4

The following Phase-4 boundaries are inherited without weakening:

- Control Plane is authoritative.
- `TELEMETRY != AUTHORITY`.
- Frontend presents backend decisions; it does not grant permission.
- UNKNOWN / STALE / CONFLICTING / UNAVAILABLE security state fails closed.
- no provider secret may be exposed to browser, logs, Audit, telemetry or traces;
- state/version/target/plan bindings must remain explicit;
- Human Gate remains user-only;
- no hidden write shortcut;
- no write command from Command Palette or notification;
- no direct normal-console Agent control;
- no force unlock / force deploy / force approval;
- rollback is a write and receives no automatic Freeze bypass.

## 3. Mandatory Phase 5 backend/runtime entry prerequisites

Before active Human-Gated UI write controls are enabled, backend/runtime must support and prove:

1. temporary scoped credentials;
2. exact target binding;
3. resource lock for the exact Work Order target;
4. policy gates;
5. capability issuance;
6. user-only Human Gate;
7. actual sandbox write execution;
8. mandatory post-write verification.

No frontend control should be connected before the corresponding backend-owned contract is real and testable.

## 4. Human Approval UX contract

The distinct Approval review flow should display backend-provided binding information as available:

- Order ID;
- Action;
- Target;
- Base SHA;
- State Version;
- Plan Hash;
- Risk Class;
- Expiry;
- nonce/reference where exposed.

Rules:

- no generic YES approval action;
- approval validity is never calculated by the frontend;
- stale or changed binding invalidates presentation according to backend state;
- approval is never inferred from chat language or Agent self-report.

Backend approval states may be rendered, for example:

- NOT_REQUIRED;
- PENDING;
- APPROVED;
- DENIED;
- EXPIRED;
- INVALIDATED.

## 5. Capability presentation contract

Only non-secret capability metadata may be displayed:

- Capability ID;
- Scope;
- Target;
- Expiry;
- Consumed State.

Never display:

- raw capability token;
- bearer credential;
- signed sensitive payload;
- private key material.

The frontend does not grant or validate capability authority.

## 6. Writer / lock / gate UX contract

The UI may display backend-derived state for:

- Writer;
- exact target lock;
- collision;
- policy;
- scope;
- state match;
- approval;
- write eligibility.

The UI presents the Control Plane result; it does not make the decision.

## 7. Execution timeline contract

Once a sandbox execution is genuinely supported, the UI may display real events such as:

- capability accepted;
- lock verified;
- state verified;
- execution started;
- execution completed;
- result recorded.

No simulated event is allowed to masquerade as real execution Evidence.

## 8. Mandatory Post Write Verification

A successful dispatch is not a completed Work Order.

Post Verify must evaluate relevant expected outcomes, potentially including:

- new Canonical SHA;
- deployed revision when applicable to the sandbox target;
- CI / regression status;
- runtime health;
- expected functional effect;
- unexpected side effects;
- Audit completeness;
- lock release.

The frontend displays the backend Post Verify result and must not self-declare completion.

## 9. Emergency Freeze UX

The real Freeze control may be connected only after the backend Freeze boundary is ready.

Requirements:

- deliberate confirmation;
- dominant global visual state;
- Writer shown FROZEN;
- Execution shown BLOCKED;
- backend-reported Approval invalidation visibly reflected;
- no automatic rollback bypass.

## 10. First Phase 5 implementation sequence

The smallest responsible sequence is:

1. re-confirm Repo / Branch / HEAD / open changes / Human Gate scope;
2. designate and verify an isolated **sandbox-only** target;
3. inventory existing Writer, capability, lock, policy, approval and Post Verify contracts from current code;
4. identify the smallest missing backend/runtime gap;
5. implement backend/runtime sandbox writer core before active UI controls;
6. static + unit + integration + regression validation;
7. controlled sandbox runtime proof;
8. only then connect Human Approval / Execution / Post Verify UI;
9. run full CI and sandbox acceptance;
10. stop at the next Human Gate whenever required.

Root cause before fix remains mandatory. Tests, policy rules, thresholds, approval semantics or security boundaries must not be weakened merely to make Phase 5 pass.

## 11. Phase 5 forbidden scope

Without a new explicit authorization, Phase 5 work must not include:

- production write integration;
- protected-branch merge;
- production deploy;
- production data mutation;
- production secret mutation;
- irreversible infrastructure mutation;
- generic unrestricted Writer;
- cross-target capability reuse;
- caller-supplied provider credentials;
- bypass of locks, policy or approval;
- frontend-derived write eligibility;
- automatic promotion toward LIVE_GATED.

## 12. Phase 5 exit acceptance target

Frozen Roadmap Phase 5 closes only when at least one controlled sandbox flow completes:

`PLAN -> HUMAN_GATE -> EXECUTE -> POST_VERIFY -> CLOSE`

with:

- user-only Human Gate;
- backend approval validation;
- scoped credential;
- exact target binding;
- resource lock;
- single-use execution capability;
- mandatory Post Verify;
- complete Audit relationship;
- correct UI presentation of real backend state.

Any UNKNOWN, stale binding, lock loss, state mismatch, policy failure, approval invalidation or authority outage must fail closed.

## 13. Evidence requirements

Every Phase-5 completion claim must be linked to concrete Evidence such as:

- exact commit SHA;
- tests and CI run IDs;
- sandbox target identity;
- Work Order ID;
- state version / Base SHA / Plan Hash;
- lock/capability/approval identifiers using non-secret metadata only;
- execution result;
- Post Verify result;
- Audit relationship;
- controlled runtime logs with secrets redacted.

Generator output is not its own sole evaluator.

## 14. IP / provenance carry-forward

All new Phase-5 code and documentation should preserve traceable repository provenance:

- exact authoring commit;
- changed-file manifest;
- dependency changes;
- generated assets/source references;
- external design/reference sources where used;
- tests/evidence that validate implementation.

Legal ownership, trademark, patent, freedom-to-operate and third-party-license conclusions remain separate legal diligence and must not be inferred merely from Git history.

## 15. Handoff state

Phase 4 is closed by explicit Human Phase-4 Exit approval.

**Phase 5 implementation is NOT started by this handoff document.**

The next builder must re-check the final closure-documentation HEAD and CI before any Phase-5 code write.

PR #35 remains draft/unmerged unless separately authorized.

No deployment is authorized by this handoff.

## 16. First acceptance criterion for Phase 5 start

Before the first Phase-5 implementation write:

- exact current HEAD confirmed;
- current CI green;
- no parallel writer collision;
- explicit sandbox target identified;
- target proven non-production;
- Phase-5 scope limited to the smallest backend/runtime gap;
- no production side effect possible.

Only then may Phase-5 implementation begin.
