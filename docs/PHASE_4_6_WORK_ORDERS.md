# PHASE 4.6 — Work Orders

Status: **PATCH PREPARED — READ-ONLY WORK ORDERS**

Baseline: `main@985ea6f214a70c83d0b9f86370876c2dcf029b49`

## Purpose

Phase 4.6 implements the frozen-roadmap read-only Work Orders surface without introducing any active approval, execution or post-write control.

The page consumes the existing Phase 4.2 UI-side view-contract wire shape and keeps backend authority separate from presentation state.

## Implemented read-only surfaces

The Work Orders route now exposes the six roadmap-required views:

- Overview;
- Lifecycle;
- Evidence;
- Findings;
- Plan;
- Audit.

## Authority and association rules

The frontend renders backend-supplied `ViewContract` / `ViewField` values only.

It does not:

- calculate risk;
- verify Evidence;
- classify Findings;
- derive lifecycle stage from `OrderStatus`;
- calculate approval or write eligibility;
- infer relationships between records when the backend contract does not supply those relationships;
- expose raw Audit payload when the backend marks it unsafe for UI display.

Missing contracts remain explicit `UNAVAILABLE`; unavailable fields remain explicit `UNKNOWN` with their backend-provided reason.

The Overview consumes a backend-supplied Work Order collection. Lifecycle, Evidence, Findings, Plan and Audit remain separately backend-supplied contracts. The page does not fabricate joins between these records.

## Phase 4 no-write boundary

No operational control is introduced. In particular there is no:

- approval action;
- execution action;
- post-verify action;
- writer trigger;
- merge control;
- deploy control;
- lock override;
- force action;
- command composer;
- credential or secret input.

Approval, Execution and Post Verify are described only as later non-operative lifecycle concepts, consistent with frozen-roadmap section 7.6. Their active semantics remain Phase 5 work.

## Data-contract coverage

The UI fields used by this phase map to existing backend Phase 4.2 contracts:

- `WORK_ORDER`: order identity, action, target, base state, expected effect, risk, status, evidence flag, independent review flag, plan hash and creation time;
- `LIFECYCLE`: backend `order_status` plus explicit unavailable `stage` where no authoritative lifecycle stage exists;
- `EVIDENCE`: source, reference, observation time, digest and backend-reported verification state;
- `FINDING`: reader, claim, observation identity and backend-owned/unavailable classification;
- `PLAN`: order/action/target/effect/risk/base state/plan hash/proposed writer/creation time/simulation-only state;
- `AUDIT`: sequence, event type, creation time, previous hash, event hash and UI-safe/unavailable payload state.

No backend contract is expanded solely to satisfy frontend presentation.

## Validation target

Before merge:

- backend regressions must remain green;
- frontend tests must remain green;
- frontend production build must succeed;
- all six required regions must remain visible when authority is unavailable;
- no button or textbox may be introduced by the Work Orders surface;
- explicit empty collections must render as zero records rather than inferred state;
- unavailable lifecycle, Finding classification and Audit payload authority must remain visible.

## Runtime status

This phase is eligible for `IMPLEMENTED` and `CI VERIFIED` evidence after CI passes.

It is **not** `RUNTIME VERIFIED` merely because component tests and a production build pass. External frontend runtime evidence is deferred until the roadmap requires a real hosted/live frontend runtime.

## Next roadmap step

After merge and successful post-merge CI, continue with **Phase 4.7 — Evidence & Audit**.
