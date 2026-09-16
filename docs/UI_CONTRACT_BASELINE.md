# Phase 3.6 UI Contract Baseline

Status: **ARCHITECTURE BASELINE COMPLETE - NO FRONTEND IMPLEMENTATION**  
Baseline repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Baseline branch/commit: `main@c30cb46524c500c9e47282e79fcfb6a0528bb9d5`  
Purpose: close the Phase 3.6 backend-to-UI vocabulary inventory without inventing frontend semantics.

## 1. Authority and scope

This document implements the architecture-preparation requirement in `docs/INTEGRATED_ROADMAP.md` section 6.6.

Rules:

- current code, tests and runtime evidence remain the technical source of truth;
- backend model -> UI model, never mock UI model -> backend model;
- `TELEMETRY != AUTHORITY`;
- UNKNOWN is explicit and must never be promoted to PASS/VERIFIED/APPROVED by the frontend;
- no frontend dependency, API, endpoint, streaming transport or state library is selected by this document;
- no write capability is added by this document.

Status language used below:

- **CONFIRMED**: directly represented by current backend code or current repository structure;
- **PARTIAL**: a backend primitive exists, but the complete UI-facing contract does not yet exist;
- **UNKNOWN**: no authoritative backend model currently defines the concept.

## 2. Backend -> UI vocabulary inventory

| Required concept | Backend source of truth | Current backend contract | UI baseline rule | Status |
|---|---|---|---|---|
| `SystemMode` | `src/alpha_orchestrator/models.py` | `OFFLINE`, `MOCK`, `READ_ONLY`, `SHADOW`, `SANDBOX_WRITE`, `LIVE_GATED`, `EMERGENCY_FREEZE` | Render these exact backend values. `WRITE_ENABLED` is **not** a `SystemMode`. | CONFIRMED |
| `writes_enabled` | `ControlGuards`, `ShadowWorkflow`, `WriteProxy` providers/state | Boolean write-enable state is separate from mode | UI may display it only as a separate authority field. It must not be converted into a synthetic mode. | CONFIRMED |
| write eligibility | `ControlGuards.pre_approval/pre_execute`, `WriteProxy._runtime_gate` | `GuardDecision(allowed, reason)` and fail-closed runtime denial reasons | UI displays backend decisions/reasons. It must not recompute eligibility. An aggregate view contract is still needed in Phase 4. | PARTIAL |
| Work Order | `models.WorkOrder` | `order_id`, action, target, base state version, expected effect, risk, status, evidence flags/list, creation time, deterministic plan hash | These fields are authoritative. UI-only fields such as title/owner/updatedAt remain UNKNOWN until modeled. | CONFIRMED/PARTIAL |
| Work Order status | `models.OrderStatus` | `DRAFT`, `VERIFIED`, `DISPUTED`, `WAITING_FOR_APPROVAL`, `APPROVED`, `EXECUTING`, `POST_VERIFY`, `DONE`, `FAILED`, `BLOCKED` | Use exact backend status. Do not silently substitute the conceptual REQUEST->... lifecycle for this enum. | CONFIRMED |
| lifecycle stage | no dedicated backend enum | The product concept uses REQUEST -> ROUTE -> READ -> VERIFY -> PLAN -> HUMAN GATE -> EXECUTE -> POST VERIFY -> CLOSE, but current backend does not expose that as one authoritative field | Phase 4 must introduce/read a backend-owned lifecycle/view contract if the UI needs a stage separate from `OrderStatus`. Frontend inference is forbidden. | UNKNOWN |
| `RiskClass` | `models.RiskClass` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Render backend value only; frontend does not calculate risk. | CONFIRMED |
| Evidence reference | `models.EvidenceRef` | `source`, `reference`, `observed_at`, `digest` | Treat as an evidence reference, not a full Evidence object. | CONFIRMED |
| read provenance | `read_plane.ReadObservation.provenance_payload()` | observation ID, source, target ID, observed URL, HTTP status, observed time, body digest/size, freshness result/window, collector, transport, verification state | This is the Phase 3 minimum provenance contract. No credential-bearing fields belong in UI view models. | CONFIRMED |
| Evidence state | no backend Evidence-state enum | Current read validation emits `verification_state="READ_VALIDATED"`; stale/invalid reads fail closed rather than becoming a generic Evidence status object | UI concept values such as UNVERIFIED/VERIFIED/STALE/CONFLICTING/INVALID/SUPERSEDED are not yet an authoritative backend enum. Phase 4 must stabilize this contract before rendering them as domain truth. | PARTIAL |
| Finding | `shadow_read.ShadowFinding` | `reader_id`, `claim`, `EvidenceRef`, `observation_id`, provenance | UI may show these exact fields. | CONFIRMED |
| Finding classification/state | no dedicated enum in `ShadowFinding` | No backend `CONFIRMED/PROBABLE/UNKNOWN/DISPUTED` classification field currently exists | Those UI concept labels must remain design vocabulary until the backend owns them. | UNKNOWN |
| state version | `state.StateSnapshot` | SHA-256 version over canonicalized state data plus snapshot data | Display `version` as authoritative state version. Frontend must not generate or mutate it. | CONFIRMED |
| canonical repository/branch/SHA | real GitHub reader/runtime evidence; no dedicated domain DTO | Repo identity and SHA can be observed, but no `CanonicalState` backend model currently aggregates repository/branch/HEAD with freshness | Phase 4 requires an authoritative read/view contract. UI must not assemble security-critical canonical state from unrelated fields or chat text. | PARTIAL |
| gates | `guards.GuardDecision`; guard reason strings; `WriteProxy` runtime denials | Boolean `allowed` plus explicit fail-closed reason at each check | A Control Rail may show backend gate results. A multi-gate aggregate schema and stable gate IDs are not yet modeled. | PARTIAL |
| locks | `locks.ResourceLock`, `ResourceLockManager` | `resource`, `owner`, `order_id`, `acquired_at`; presence/ownership enforced | UI concept lock types/status/expiry are not backend facts. No READ/WRITE/EXCLUSIVE enum or lock TTL exists in current model. | PARTIAL |
| approval | `approvals.Approval`, `ApprovalAuthority` | approval ID, order/action/target, plan hash, base state version, approver, expiry, nonce, single-use state | UI may show non-secret binding metadata. Raw nonce should not be treated as a display requirement merely because it exists internally. A normalized approval-state enum is not yet modeled. | PARTIAL |
| capability metadata | `approvals.Capability` | capability ID, order ID, action, target, plan hash, base state version, expiry | Non-secret metadata is displayable. Capability issuance/validity remains backend authority. | CONFIRMED |
| execution | `write_proxy.ExecutionResult` | execution ID, success boolean, detail reason, output mapping | Phase 4 remains read-only; Phase 5 may expose backend execution views. No generalized execution-state enum/timeline DTO exists yet. | PARTIAL |
| post-verification | `OrderStatus.POST_VERIFY`; mock/shadow flow semantics | Backend has a Work Order status marker and planned simulation step, but no structured post-verification checklist/result model | UI concept checklist statuses are not yet backend truth. Stabilize in Phase 5 before active write UX. | PARTIAL |
| agent roles | repository `agents/` plus Shadow allowed readers / WriteProxy writers | Leader plus reader/verifier/writer role material exists; current code also names `code_writer` and `infra_writer` | Role identity can be mapped from backend/repository data only. | PARTIAL |
| agent health | no authoritative runtime model | No backend `HEALTHY/DEGRADED/...` model currently exists | Do not implement health badges as domain truth until Phase 4 runtime contracts exist. | UNKNOWN |
| agent runtime state | no authoritative runtime model | No backend `STARTING/IDLE/RUNNING/...` state contract exists | Must be introduced/read from runtime authority, not inferred from animation or logs. | UNKNOWN |
| agent activity | no authoritative runtime model | No backend `READING/THINKING/VERIFYING/...` activity contract exists | Activity remains distinct from health and permission. | UNKNOWN |
| telemetry | no live telemetry contract in current backend | No confirmed tokens/s, latency, context-percent or edge-flow schema | Only render metrics that exist in a verified Phase 4 telemetry contract. | UNKNOWN |
| connector read boundary | `connectors/*`, `ReadSourcePolicy`, read transports | constrained backend-owned read transports and policies exist | Transport availability is not equivalent to a connector-health object. | CONFIRMED/PARTIAL |
| connector state/health | no authoritative connector-status model | No backend `HEALTHY/DEGRADED/AUTH_ERROR/RATE_LIMITED/...` enum exists | Phase 4 must expose connector state explicitly if the UI needs it. | UNKNOWN |
| Audit event | `events.AuditEvent` / `AuditLog` | `seq`, `event_type`, payload, `created_at`, `prev_hash`, `event_hash`; append-only and hash-chained **in-memory scaffold** | Use sequence/hash identities as current facts. Do not claim durable WORM or production persistence from this scaffold. | CONFIRMED/PARTIAL |
| Audit relationships | event payloads plus Work Order/Evidence IDs where emitted | No general typed relationship graph currently exists | Provenance/Audit graph edges must come from explicit backend relationships in Phase 4; frontend must not invent them. | PARTIAL |

## 3. Source-of-truth classes for the future UI

The UI concept's six source classes remain valid, with the following backend interpretation:

### AUTHORITATIVE

Backend/control-plane state such as:

- `SystemMode`;
- `writes_enabled`;
- `StateSnapshot.version`;
- `GuardDecision` / runtime denial reasons;
- resource-lock ownership;
- Emergency Freeze when represented by backend mode/state;
- future Canonical State view contract.

### WORK_ORDER

Backend Work Order and plan state such as:

- `WorkOrder`;
- `OrderStatus`;
- `RiskClass`;
- `plan_hash`;
- `ShadowPlan`;
- later approval/execution/post-verify view contracts.

### EVIDENCE

Read/evidence/finding data such as:

- `ReadObservation` provenance;
- `EvidenceRef`;
- `ShadowFinding`;
- future Evidence/verification/conflict contracts.

### RUNTIME

Currently incomplete. Phase 4 must provide explicit agent/runtime/connector state before the UI may present it as system truth.

### TELEMETRY

Currently unimplemented as a stable contract. Latency, tokens/s, context usage, edge activity and event-flow animation remain unavailable until a real telemetry source exists.

### LOCAL_UI

May own only presentation state such as:

- selected tab;
- filters/sort;
- open drawers;
- zoom/pan;
- layout lock;
- density preference;
- other non-domain presentation choices.

LOCAL_UI must never own or derive security authority.

## 4. UI concept unknowns resolved by the real repository

The Phase 3.6 inventory resolves these previously unverified UI-planning assumptions:

1. **Repository / branch / HEAD**: confirmed for this baseline as `alpha-phoenix-labs/alpha-agent-orchestrator`, `main`, `c30cb46524c500c9e47282e79fcfb6a0528bb9d5`.
2. **Current application stack**: confirmed as a Python package (`pyproject.toml`, Python >=3.11) with pytest as a dev dependency. The repository root does not establish a React/Next.js/Tailwind/Zustand/React Flow frontend stack.
3. **System modes**: exact backend enum confirmed; `WRITE_ENABLED` is not one of them.
4. **Current read freshness window**: current real-read/shadow provenance paths use a 60-second maximum in their existing consumers. This is a backend value, not a frontend rule.
5. **Audit integrity**: current `AuditLog` is append-only and hash-chained in memory; durable append-only/WORM/database guarantees remain UNKNOWN.
6. **Lock types**: the current backend has exact-target ownership locks, not a typed READ/WRITE/EXCLUSIVE taxonomy.
7. **Approval binding**: order/action/target/plan hash/base state version/approver/expiry/single-use behavior are real backend properties.
8. **Frontend stack**: remains intentionally unselected until Phase 4.3.
9. **WebSocket/SSE/Redis**: no choice is made by the current backend baseline. Redis Pub/Sub, multiplexing and delta compression remain optional/deferred unless real scale evidence justifies them.
10. **Agent health/runtime/activity and connector health**: remain genuine backend contract gaps, not values the frontend may invent.

## 5. V1 Desktop Master Wireframe contract

The UI concept's outstanding master-wireframe planning point is accepted here as an architecture contract, not as frontend implementation.

A desktop-first Mission Control composition around 1440px must be able to present **simultaneously**:

- a global header containing authoritative system context;
- primary navigation for Mission Control, Work Orders, Evidence & Audit, and System / Swarm;
- an active Work Order context/lifecycle area;
- the Leader interaction surface as the primary command surface;
- a live topology/agent-observability region without presenting animation as authority;
- a persistent Control Rail containing authoritative mode/canonical/gate/lock/writer/blocker state;
- an Active Context Bar capable of distinguishing viewed state from current state.

Design-reference dimensions from the UI concept remain non-binding implementation hints:

- header ~56px;
- primary navigation ~232px;
- control rail ~304px;
- active context bar ~44px;
- remaining main workspace flexible.

The master layout must obey:

- no direct writer console in Leader Composer;
- no deploy/merge/approve/unlock/force shortcuts in normal navigation or command palette;
- topology animation is telemetry only;
- UNKNOWN/stale/authority-unavailable states remain visible;
- Emergency Freeze remains globally dominant once the backend control exists;
- responsive variants must never hide safety-critical state.

This closes the **planning** item. Visual/frontend implementation remains Phase 4.

## 6. Coverage of UI-injection work against the integrated roadmap

| UI-injection requirement | Binding roadmap placement | Current disposition |
|---|---|---|
| Backend vocabulary / UI contract baseline | Phase 3.6 | **Covered by this document** |
| V1 desktop master-wireframe planning contract | Phase 3.6 architecture preparation; implementation in Phase 4.4/4.5 | **Planning contract covered; no frontend code** |
| Mission Control / Work Orders / Evidence & Audit / System-Swarm | Phase 4.4-4.10 | **Planned; not started** |
| Real authoritative view models | Phase 4.2 | **Planned; backend gaps identified above** |
| Actual frontend-stack verification/selection | Phase 4.3 | **Planned; current repo is Python-only baseline** |
| Live event schema, ordering, gap/resync behavior | Phase 4.11 | **Planned; transport intentionally undecided** |
| Reconnect/backoff/heartbeat/stale/authority-unavailable handling | Phase 4.12 | **Planned** |
| State drift / historical-vs-current separation | Phase 4.13 | **Planned** |
| Secret redaction / accessibility / safety UX | Phase 4.14-4.15 | **Planned** |
| Human Gate / approval / execution / post-verify / freeze UX | Phase 5 | **Planned; backend-owned semantics required** |
| Adversarial UI/stream/security acceptance | Phase 6 | **Planned** |
| Integrated go-live including Operations Console | Phase 7 | **Planned** |
| Light theme, WebGL alternative, flamegraphs, advanced charts, premium motion | Deferred post-live roadmap section | **Explicitly deferred** |
| Redis Pub/Sub / multiplexed gateway / delta compression | Deferred unless justified by real scale | **Not assumed** |

No UI-injection requirement identified in the project concept needs to be pulled ahead of its existing roadmap phase in order to close Phase 3.6.

## 7. Phase 4 entry gaps intentionally left open

These are not Phase 3.6 failures. They are concrete Phase 4 contract work:

- authoritative `CanonicalState` read model;
- authoritative lifecycle/stage view model if a stage is required separately from `OrderStatus`;
- normalized Evidence status / verification records / conflict relationships;
- normalized Finding classification/status;
- gate summary with stable IDs and state;
- UI-safe lock view model with backend-owned state/expiry semantics if needed;
- normalized approval state view;
- normalized execution and post-verification view models;
- writer status view;
- agent identity/health/runtime/activity models;
- connector health/auth state models;
- explicit Audit/provenance relationship model;
- live telemetry/event schema and resync semantics.

The frontend must not fill these gaps locally.

## 8. Phase 3.6 acceptance result

Acceptance result: **PASS for architecture baseline**.

Evidence:

- all concepts required by roadmap section 6.6 have been inventoried;
- each concept is mapped to a real backend source or explicitly marked PARTIAL/UNKNOWN;
- System Mode and write permission are kept separate;
- UI-only vocabularies are not promoted into backend truth;
- the outstanding V1 master-wireframe planning constraint is captured;
- Phase 4 contract gaps are explicit;
- no frontend implementation or new dependency was introduced.

## 9. Current Phase 3 runtime alignment note

This document does **not** declare the entire Phase 3 complete.

At the time of this baseline, current repository `main` is `c30cb46524c500c9e47282e79fcfb6a0528bb9d5`, while the live Render read-proxy deployment `dep-dalbl9id0e5s73eqk3hg` is still built from `9f0f9dfbeab133a4fa22a157442bba612f30dfdc`.

The earlier Render real-read evidence remains valid evidence for the approved constrained proxy boundary, but it predates the merged Phase 3.5 expanded provenance contract. Therefore the Phase 3 exit gate must not be declared complete until the **current-main** provenance contract is revalidated against the real read path without mutation or credential exposure.
