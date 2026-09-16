# Integrated Development Roadmap

Status: CURRENT INTEGRATED DEVELOPMENT ROADMAP DRAFT

Last revised: 2026-09-16

Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`

## 1. Purpose and authority

This document is the current integrated execution roadmap for the ALPHA Agent Orchestrator main program.

It does **not** delete or replace the historical baseline in `docs/GO_LIVE_GATES.md`. That file remains preserved as the original safety-phase baseline and gate record.

This roadmap extends that baseline by placing the approved Operations Console / UI, observability, evidence, runtime and resilience work inside the same sequential development program.

There is no parallel UI development track.

For ongoing development after this revision:

1. Current code, current tests and real runtime evidence remain the highest technical source of truth.
2. This document governs the intended development sequence and scope where the original gate file is intentionally high-level.
3. `docs/GO_LIVE_GATES.md` remains authoritative for the original safety ordering and historical phase definition.
4. The project-source UI concept document `AGENT_SWARM_UI_KONZEPT_KENNTNISNAHME_MAIN_DEV.txt` is an architecture/product requirement source, not an independent implementation roadmap.
5. If this roadmap conflicts with verified runtime behavior or current code, the contradiction must be surfaced and resolved explicitly rather than silently interpreted.

## 2. Non-negotiable architecture rules

The integrated roadmap follows these rules throughout all phases:

- one main development sequence;
- no parallel product branch with an independent architectural truth;
- backend/control-plane authority before frontend interpretation;
- `TELEMETRY != AUTHORITY`;
- readers before writers;
- Shadow before Sandbox Write;
- Sandbox Write before Adversarial Acceptance;
- Adversarial Acceptance before `LIVE_GATED`;
- no production write integration before all required gates pass;
- no UI component may independently grant write eligibility, validate approval, verify evidence, resolve locks, evaluate policies or define canonical state;
- no secret, credential, capability token, cookie, private key or sensitive raw payload may be exposed through UI, audit, logs or telemetry;
- all write-capable behavior remains human-gated according to the user-only Human Gate model.

## 3. Phase 1 — OFFLINE

Status: **COMPLETE**

### Goal

Establish a deterministic, fully offline control-plane core with no credentials and no network writes.

### Scope

- deterministic core tests;
- Work Orders;
- state/version handling;
- resource locks;
- guards;
- capability foundation;
- WriteProxy foundation;
- audit foundation;
- no credentials;
- no network writes.

### UI / observability placement

No frontend implementation is required in Phase 1.

The backend concepts defined here later become authoritative UI inputs; the UI must not redefine them.

### Exit gate

Core behavior is deterministic and fail-closed.

---

## 4. User-directed pre-Phase-2 hardening gate

Status: **COMPLETE**

### Required controls

- WriteProxy revalidates mode, writes-enabled state, current state and exact target lock immediately before dispatch;
- execution capability is bound to the approved base-state version;
- one approval and at most one execution are permitted per Work Order;
- resource locks are derived from the exact Work Order target;
- Shadow plans require an explicit independent-review result;
- Shadow, WriteProxy and resource scopes use one canonical action schema;
- read credentials are owned only by backend transport and are never caller supplied;
- GitHub reads are restricted to an explicit repository allowlist.

### UI / observability placement

No frontend implementation is required here.

These controls later feed the authoritative status shown by gates, locks, writer state, approval state and Control Rail views.

---

## 5. Phase 2 — MOCK

Status: **COMPLETE**

### Goal

Validate the full control flow using only mock external targets.

### Scope

- mock GitHub target;
- mock Render target;
- collision tests;
- stale-state tests;
- replay tests;
- scope tests;
- Human Gate behavior;
- post-write failure behavior;
- exact target lock behavior.

### UI / observability placement

No production UI implementation is required.

Mock data may later be reused for development-only frontend fixtures, but mock output must never be represented as real Evidence or runtime state.

### Exit gate

Mock workflow passes with no real external mutation.

---

## 6. Phase 3 — REAL READ-ONLY

Status: **IN PROGRESS**

### Goal

Allow the orchestrator to observe real external systems through constrained read-only boundaries while producing attributable, fresh and verifiable Evidence.

### 6.1 GitHub real read-only

Status: **RUNTIME VERIFIED**

Required properties:

- own GitHub read transport;
- fixed GET behavior;
- backend-only credential ownership;
- repository allowlist;
- provenance;
- freshness;
- real read evidence;
- no write capability through the read path.

### 6.2 Render read-only boundary

Status: **MERGED + CI VERIFIED**

Required properties:

- fixed GET transport;
- positive non-secret path allowlist;
- sensitive descendants denied;
- constrained service/deploy/Postgres metadata paths;
- no caller-defined HTTP method;
- no caller-defined auth headers;
- credential redaction.

### 6.3 Render repository runtime verification

Status: **OPEN**

This is the next active technical gate.

Acceptance requires:

- one real request through the repository `RenderReadTransport` or an explicitly approved technically equivalent constrained GET-only proxy;
- backend-only credential handling;
- an allowlisted non-secret endpoint;
- successful provenance capture;
- successful freshness check;
- no credential output;
- no deploy, restart, environment mutation, secret mutation or database write;
- no reachable write capability through the read path.

### 6.4 Evidence provenance and freshness closure

Before Phase 3 closes, real readers must expose a stable minimum Evidence/provenance contract sufficient to identify:

- logical source;
- source/target identifier;
- observed URL or canonical read target where appropriate;
- observation time;
- body/content digest;
- response size where applicable;
- freshness result;
- collector/transport provenance;
- verification state.

Stale, invalid or ambiguous observations must never be silently interpreted as current.

### 6.5 UI contract baseline

This is architecture preparation only. **No frontend implementation is required to close Phase 3.**

Before Phase 4, the real backend vocabulary must be inventoried and mapped for UI consumption, including as applicable:

- `SystemMode`;
- `writes_enabled` and write eligibility as concepts distinct from `SystemMode`;
- Work Order status/lifecycle;
- RiskClass;
- Evidence state;
- Finding state;
- state version;
- canonical repository/branch/SHA;
- gates;
- locks;
- approval state;
- capability metadata;
- execution state;
- post-verification state;
- agent runtime/health/activity;
- connector state;
- audit event identity and relationships.

Rule: **backend model -> UI model**, never **mock UI model -> backend model**.

Confirmed example: `WRITE_ENABLED` must not be invented as a backend `SystemMode` if the backend models write permission separately.

### Phase 3 exit gate

Phase 3 closes only when:

- GitHub repository read transport has real runtime evidence;
- Render repository read transport has real runtime evidence;
- read credentials remain backend-owned;
- provenance is demonstrated;
- freshness is demonstrated;
- real read paths expose no mutation capability;
- required authoritative data concepts are mapped sufficiently for Phase 4.

---

## 7. Phase 4 — SHADOW + READ-ONLY OPERATIONS CONSOLE

Status: **NOT STARTED**

### Goal

Run real tasks using real Evidence and real planning while executing no writes, and build the first real Operations Console entirely inside that hard read-only boundary.

### 7.1 Shadow core first

Backend/runtime must first support:

- real tasks;
- real readers;
- real Evidence;
- real verification;
- Findings;
- Plans;
- explicit Independent Review;
- proposed writes;
- no write execution.

### 7.2 Authoritative read models / view contracts

Stabilize the data contracts consumed by the UI for:

- System State;
- Canonical State;
- Work Orders;
- Lifecycle;
- Evidence;
- Findings;
- Provenance;
- Plans;
- Gates;
- Locks;
- Writers;
- Agents;
- Connectors;
- Audit;
- Runtime;
- Telemetry.

Each visible UI field must belong to one source-of-truth class:

- AUTHORITATIVE;
- WORK_ORDER;
- EVIDENCE;
- RUNTIME;
- TELEMETRY;
- LOCAL_UI.

Security-sensitive state must never be reconstructed from TELEMETRY or LOCAL_UI.

### 7.3 Verify and select the actual frontend stack

Only after backend contracts are sufficiently stable:

- inspect the repository again;
- confirm whether a frontend already exists;
- confirm actual dependencies;
- choose the smallest responsible frontend stack;
- evaluate React/Next.js, Tailwind, Zustand, React Flow, WebSocket/SSE or alternatives only against verified project needs.

No library is added only because the concept document mentioned it.

### 7.4 App shell

Build the common shell:

- global header;
- primary navigation;
- Active Context Bar;
- routing;
- error isolation;
- basic data/state layer.

Primary navigation target:

- Mission Control;
- Work Orders;
- Evidence & Audit;
- System / Swarm.

### 7.5 Mission Control — read-only first

Implement a real read-only Mission Control view for:

- Leader interaction;
- active Work Order;
- Lifecycle;
- current Findings;
- Evidence Summary;
- Canonical State;
- Gates;
- Locks;
- Writer status;
- Blockers.

No write shortcut or operational writer trigger is permitted in this phase.

### 7.6 Work Orders

Implement read-only views for:

- Overview;
- Lifecycle;
- Evidence;
- Findings;
- Plan;
- Audit.

Approval, Execution and Post Verify may exist as non-operative lifecycle placeholders, but must not expose active write controls.

### 7.7 Evidence & Audit

Implement:

- Evidence Explorer;
- Findings;
- verification records;
- provenance/trace graph;
- Audit Timeline;
- Trace Inspector.

Read-only chain of custody target:

`REQUEST -> EVIDENCE -> FINDING -> PLAN`

The future chain

`APPROVAL -> CAPABILITY -> EXECUTION -> POST_VERIFY`

may be represented structurally but remains non-operative in Phase 4.

### 7.8 System / Swarm

Implement read-only system views for:

- System Overview;
- Agents;
- Connectors;
- Locks;
- Policies where backed by real data;
- Control Plane;
- System Health.

Agent state must keep separate concepts for:

- Health;
- Runtime State;
- Activity;
- Telemetry.

For example, `THINKING` is an Activity, not a Health or permission state.

### 7.9 Live topology and Agent Grid

Only after stable data contracts:

- Leader node;
- worker nodes;
- runtime activity edges;
- Agent Grid;
- Work Order association;
- latency;
- tokens/s where real telemetry exists;
- context usage where real telemetry exists.

Safety semantics:

- animated edge != verified;
- glow != approved;
- active agent != write permitted.

### 7.10 Trace / Waterfall

Show the temporal flow of real work such as:

- Route;
- Read;
- Verify;
- Plan;
- later Human Gate;
- later Execution;
- later Post Verify.

Trace/Activity is observability, not authoritative Audit.

### 7.11 Live event ingestion

Select WebSocket, SSE or another mechanism only after requirements are verified.

Regardless of transport, event design should provide sufficient identity/versioning to detect as applicable:

- duplicates;
- missing sequence;
- stale events;
- out-of-order events;
- state-version drift;
- snapshot/resync requirement.

### 7.12 Connection resilience

Before Phase 4 closes, the live UI must handle:

- connection status;
- reconnect;
- bounded backoff;
- heartbeat where required;
- sequence gaps where applicable;
- snapshot resync;
- stale marking;
- authority unavailable.

Loss of connection must never leave stale data visually presented as current.

### 7.13 Secret redaction

Never render:

- API keys;
- bearer tokens;
- cookies;
- private keys;
- raw capability tokens;
- full sensitive payloads.

### 7.14 Accessibility and safety UX

Minimum requirements:

- keyboard navigation;
- visible focus state;
- reduced-motion handling;
- screen-reader labels;
- status never communicated by color alone;
- explicit UNKNOWN state;
- persistent presentation of Freeze, Blocker and other critical states.

### Phase 4 exit gate

At least one real Shadow Work Order must be observable from:

`REQUEST -> READ -> VERIFY -> FINDING -> PLAN`

with:

- no writes;
- no operative approval execution;
- no frontend evidence verification;
- no frontend policy decision;
- no security state derived from telemetry;
- stale/unknown state visible;
- Control Plane retained as authority.

---

## 8. Phase 5 — SANDBOX WRITE + HUMAN-GATED CONTROL UX

Status: **NOT STARTED**

### Goal

Enable the first real write-capable workflow only in a controlled sandbox and expose that workflow through a Human-Gated UI backed directly by real control-plane contracts.

### 8.1 Sandbox writer core first

Before active UI controls, backend/runtime must support:

- temporary scoped credentials;
- exact target binding;
- resource lock;
- policy gates;
- capability issuance;
- user-only Human Gate;
- write execution;
- mandatory post-write verification.

### 8.2 Human Approval UX

Add a distinct Approval review flow showing backend-provided binding information such as:

- Order ID;
- Action;
- Target;
- Base SHA;
- State Version;
- Plan Hash;
- Risk Class;
- Expiry;
- nonce/reference where the backend exposes it.

No generic `YES` approval action.

### 8.3 Approval state

UI displays backend state only, for example:

- NOT_REQUIRED;
- PENDING;
- APPROVED;
- DENIED;
- EXPIRED;
- INVALIDATED.

The frontend must not calculate approval validity itself.

### 8.4 Capability display

Display non-secret metadata only:

- Capability ID;
- Scope;
- Target;
- Expiry;
- Consumed State.

Never expose a raw capability token.

### 8.5 Writer / lock / gate UX

Display backend-derived status for:

- Writer;
- Lock;
- Collision;
- Policy;
- Scope;
- State match;
- Approval;
- Write eligibility.

The UI presents the decision; it does not make the decision.

### 8.6 Execution timeline

Display real execution lifecycle events such as:

- capability accepted;
- lock verified;
- state verified;
- execution started;
- execution completed;
- result recorded.

### 8.7 Post Write Verification

A successful dispatch is not a completed Work Order.

Post Verify must evaluate the relevant expected outcomes, potentially including:

- new Canonical SHA;
- deployed revision;
- CI/regression status;
- runtime health;
- expected functional effect;
- unexpected side effects;
- Audit completeness;
- lock release.

### 8.8 Emergency Freeze UX

Connect the real Freeze control only after the backend Freeze boundary is ready.

Requirements:

- deliberate confirmation;
- dominant global visual state;
- Writer shown FROZEN;
- Execution shown BLOCKED;
- Approval invalidation shown when the backend reports it.

Rollback is itself a write and receives no automatic Freeze bypass.

### Phase 5 exit gate

At least one controlled sandbox flow must complete:

`PLAN -> HUMAN_GATE -> EXECUTE -> POST_VERIFY -> CLOSE`

with:

- user-only Human Gate;
- backend approval validation;
- scoped credential;
- exact target binding;
- lock;
- single-use execution capability;
- mandatory Post Verify;
- complete Audit relationship;
- correct UI presentation of the real backend state.

---

## 9. Phase 6 — ADVERSARIAL ACCEPTANCE

Status: **NOT STARTED**

### Goal

Prove that both core control-plane logic and integrated UI/observability behavior remain fail-closed under hostile, stale, inconsistent and degraded conditions.

### 9.1 Existing core adversarial cases

- prompt injection;
- stale SHA/state;
- replayed approval;
- duplicate execution;
- lock race;
- verifier disagreement;
- writer scope violation;
- control-plane outage;
- emergency freeze.

### 9.2 Integrated UI / stream adversarial cases

Add tests for:

- stale UI state;
- delayed event;
- duplicate event;
- out-of-order event;
- sequence gap;
- reconnect during active Work Order;
- failed snapshot/resync;
- telemetry contradicting Canonical State;
- telemetry showing RUNNING while Control Plane reports BLOCKED;
- authority unavailable;
- Evidence becoming stale while a view is open;
- Approval invalidated while review UI is open;
- state version change during approval;
- Base SHA change;
- Plan Hash change;
- lock loss;
- Freeze during execution preparation;
- Freeze during active session;
- historical state visually confused with live state;
- secret material injected into event payload;
- credential leakage through error text;
- raw capability leakage through log/event output;
- Agent self-claiming VERIFIED/APPROVED;
- frontend attempting to derive security state locally.

### 9.3 Frontend security acceptance

Prove:

- fail-closed behavior;
- no hidden write shortcut;
- no write commands in Command Palette;
- no approval directly from notification;
- no policy override;
- no force unlock;
- no force deploy;
- no direct writer activation;
- no security action available only through hidden hover controls.

### 9.4 Resilience and performance acceptance

Where required by real load:

- coalesce rapid telemetry updates;
- selective rendering/subscription;
- prevent uncontrolled re-render loops;
- isolate individual node/card rendering failures;
- paginate or virtualize large Evidence/Audit datasets.

### Phase 6 exit gate

Core, runtime, UI and observability layers all remain fail-closed under the defined adversarial scenarios.

---

## 10. Phase 7 — LIVE_GATED

Status: **NOT STARTED**

### Goal

Reach one integrated go-live state for the main program.

There is no separate backend go-live followed by an independently developed UI go-live.

Required integrated components include, as applicable:

- Control Plane;
- Readers;
- Writers;
- Human Gate;
- Evidence;
- Verification;
- Audit;
- Runtime;
- Mission Control;
- Work Orders;
- Evidence & Audit views;
- System / Swarm views;
- Emergency Freeze;
- Observability.

### 10.1 Production readiness review

Before any productive write capability:

- Phase 1-6 evidence complete;
- relevant CI green;
- required runtime evidence complete;
- security boundaries unchanged or explicitly re-approved;
- secrets isolated;
- Audit relationships complete;
- Freeze tested;
- recovery behavior documented;
- real authentication/authorization boundaries reviewed.

The UI concept mentions RBAC as a quality target, but no concrete RBAC model is currently established by that concept alone. No authorization model may be invented only for the UI.

### 10.2 Human go-live gate

`LIVE_GATED` requires an explicit user decision after Phase 1-6 evidence.

There is no automatic promotion from Phase 6.

---

## 11. Deferred post-live product enhancements

These are sequential future backlog items, not a parallel development track and not V1 safety prerequisites unless later promoted by explicit decision:

- Light Theme;
- alternative WebGL topology rendering;
- Flamegraphs;
- advanced analytics charts;
- persistent density preferences;
- advanced heatmaps;
- separate Admin/Maintenance Plane;
- additional premium motion/visual effects;
- Redis Pub/Sub, multiplexed WebSocket Gateway or delta-compression infrastructure unless real scale requirements justify them.

## 12. Current execution pointer

At the time of this revision:

- Phase 1: complete;
- pre-Phase-2 hardening: complete;
- Phase 2: complete;
- Phase 3: in progress;
- GitHub real read-only path: runtime verified;
- Render read-only boundary: merged and CI verified;
- next active technical gate: **Phase 3 Render repository `RenderReadTransport` runtime verification**.

No Phase 4 implementation should begin before the Phase 3 exit gate is satisfied.
