# Roadmap Amendment - 2026-09-17 - Premium Frontend Acceptance

Status: **USER-APPROVED ROADMAP CLARIFICATION - NO PHASE REORDERING**  
Applies to: `docs/INTEGRATED_ROADMAP.md`  
Base roadmap status: frozen/binding  
Repository baseline: `main@57b891d857d4f78dea1f2fc2ae6ade5e6e97a2c3`

## 1. Reason

The approved Premium Frontend V1 implementation instruction clarifies the intended final quality of the Operations Console without changing the existing Control Plane authority model, phase order or write-safety boundaries.

The frozen roadmap already contains the correct architecture and sequence for the Operations Console, including authoritative backend view contracts, read-only Mission Control, topology, trace, live-event schema safety, connection resilience, state-drift handling, secret redaction, accessibility, Human-Gated write UX and later adversarial acceptance.

This amendment tightens product acceptance where the existing roadmap is less explicit than the approved frontend target. It does not create a parallel UI roadmap and does not move Phase 5 write behavior into Phase 4.

## 2. Non-negotiable boundaries retained

This amendment does not change the following rules:

- the Control Plane remains authoritative;
- `TELEMETRY != AUTHORITY`;
- backend model -> UI model, never mock UI model -> backend model;
- UNKNOWN, STALE and UNAVAILABLE remain explicit and fail closed;
- the frontend does not calculate approval validity, write eligibility, Evidence verification, Finding classification, policy results, locks, capability validity or Post Verify completion;
- no normal V1 direct Agent control, Writer activation, deploy, force-approval, force-unlock or force-execution action is introduced;
- active approval, execution, Writer and Emergency Freeze controls remain Phase 5 scope and require real backend-owned contracts;
- transport, graph, chart or state-management libraries remain evidence-based implementation choices rather than roadmap-mandated dependencies.

## 3. Clarification to Phase 4.4 / 4.5 - Premium Operations Console master direction

The Phase 4 App Shell and Mission Control implementation must converge on the approved desktop-first Premium Operations Console target rather than merely proving that the required fields can be rendered.

The 1440px master direction is therefore a Phase 4 product acceptance target. At that width, Mission Control must form a coherent primary screen capable of presenting the applicable verified data for:

- Global Header and authoritative system context;
- primary navigation;
- Leader interaction surface;
- active Work Order and lifecycle context;
- Current Findings and Evidence Summary;
- live topology / Agent observability region;
- Agent Grid;
- Trace / Waterfall;
- Recent Events;
- authoritative Control Rail / Control Plane state;
- Active Context Bar distinguishing viewed and current state.

Visual implementation must use a repository-owned design system suitable for a premium dense Operations Console, with consistent dark-surface, spacing, typography, focus, state, border and motion tokens. Exact visual tokens remain implementation-owned and testable; visual styling must never become domain authority.

Premium presentation and technical safety are co-equal acceptance concerns. Decorative animation, glow, pulse or telemetry activity must never imply VERIFIED, APPROVED or WRITE PERMITTED.

## 4. Clarification to Phase 4.11 - Recent Events and real live-delivery evidence

The live-event work has two distinct obligations:

1. schema/order/state-safety semantics; and
2. a real delivery path for live runtime/telemetry where the UI presents data as live.

The existing requirements for event identity/versioning, duplicate detection, missing sequence, stale or out-of-order events, state-version drift, malformed-event rejection and snapshot/resync remain unchanged.

Additionally, a Phase 4 completion claim for a **live** Runtime / Telemetry experience is not satisfied by a static or periodically fetched REST snapshot alone. Before the Phase 4 exit gate may be declared complete, the repository/runtime must provide and verify a real event producer and delivery path using WebSocket, SSE or another mechanism selected from verified requirements.

No specific transport is mandated by this amendment. Selecting WebSocket, SSE or another mechanism still occurs only after real requirements and repository architecture justify the choice.

The visible Recent Events surface, when backed by real contracts, must be able to present safe metadata such as:

- timestamp;
- source;
- Agent / role where authoritative;
- Work Order relationship where authoritative;
- event type;
- state/status where authoritative;
- latency where real telemetry exists;
- safe metadata only.

Secret-bearing or full sensitive payloads remain prohibited.

## 5. Clarification to Phase 4.12 - Runtime proof of stale/resync behavior

Connection-resilience completion requires more than local state-machine tests once a real live transport exists.

Before Phase 4 closes, controlled runtime evidence must demonstrate the applicable live path handling of:

- connected/disconnected status;
- reconnect with bounded backoff;
- heartbeat where required by the selected transport;
- sequence gap or continuity failure;
- snapshot/resync requirement;
- failed resync behavior;
- stale marking;
- authority unavailable.

A connection loss or failed resync must never leave previously received data visually presented as current authority.

Transport-neutral unit/contract logic remains valid evidence for its own safety boundary, but it is not by itself evidence that a real producer/endpoint/transport has been integrated.

## 6. Clarification to Phase 4.15 - Accessibility, responsive behavior and fault isolation

In addition to the existing accessibility requirements, Phase 4 frontend acceptance includes:

- responsive behavior that never hides safety-critical state;
- keyboard navigation and visible focus states across primary navigation and interactive read/drill-down surfaces;
- reduced-motion behavior for topology, event and activity animation;
- status meaning never communicated by color alone;
- explicit UNKNOWN / STALE / BLOCKED / FAILED / UNAVAILABLE presentation where applicable;
- panel/node/component error isolation so one rendering failure does not collapse the whole Operations Console;
- persistent visibility of critical Freeze / Blocker state once real backend contracts exist;
- coherent desktop master behavior around 1440px.

## 7. Clarification to Phase 6.4 - Performance and dense-data acceptance

The existing resilience/performance acceptance remains in Phase 6, and must include the following when real load or dataset size makes them applicable:

- coalescing or otherwise bounding rapid telemetry updates;
- selective rendering/subscription to avoid uncontrolled re-render loops;
- pagination or virtualization for large Evidence, Audit or other dense tabular datasets;
- isolated node/card/panel rendering failures;
- responsive variants that preserve safety-critical state and authoritative context.

These are acceptance requirements, not authorization to introduce speculative infrastructure. Redis, multiplexed gateways, WebGL, delta compression or additional state libraries remain deferred unless real scale evidence justifies them.

## 8. Phase 4 exit-gate additions

The existing Phase 4 exit gate remains fully binding. The following additional acceptance criteria are added:

- the 1440px Mission Control master is a coherent premium Operations Console rather than only a collection of technically functional panels;
- Recent Events is represented as a real read-only product surface when its backend/live contract is available;
- any UI data presented as live Runtime / Telemetry is backed by a real, verified producer + delivery path rather than snapshot-only simulation;
- real live-path evidence proves stale / resync / authority-unavailable behavior before Phase 4 is declared complete;
- responsive, keyboard, visible-focus, reduced-motion and non-color-only status behavior is validated;
- individual frontend rendering failures are isolated from the overall console;
- no premium visual effect is permitted to weaken or obscure Control Plane authority, UNKNOWN/STALE state, blockers or security boundaries.

If the real live producer/endpoint/transport is not yet available when all transport-neutral Phase 4.11/4.12 logic is complete, Phase 4 remains **BLOCKED on missing runtime evidence** rather than silently treating the transport-neutral boundary as full live integration.

## 9. Test and evidence alignment

The roadmap test sequence remains layered and evidence-driven. Frontend validation should cover, as applicable:

1. static/type/build checks;
2. component tests;
3. backend-to-frontend contract tests;
4. live-event schema/order/resync tests;
5. integration and regression tests;
6. accessibility tests;
7. performance tests where real load justifies them;
8. adversarial UI/stream tests in Phase 6;
9. controlled runtime validation inside the phase where the real integration exists.

A green unit or component suite does not prove real live-delivery readiness.

## 10. Scope and sequencing conclusion

No roadmap phase is inserted, removed, skipped or reordered by this amendment.

Effective placement remains:

- Phase 4: premium read-only Operations Console, live/read-only observability, resilience, state safety, secret redaction and accessibility;
- Phase 5: Human-Gated sandbox write UX and backend-owned active controls;
- Phase 6: adversarial, resilience, security and performance acceptance;
- Phase 7: integrated `LIVE_GATED` readiness and explicit human go-live decision.

The approved Premium Frontend V1 instruction therefore strengthens acceptance quality without changing the fundamental program architecture.
