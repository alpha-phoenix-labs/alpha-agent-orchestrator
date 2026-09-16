# PHASE 4.10 — Trace / Waterfall

Status: **PATCH PREPARED — READ-ONLY TRACE / WATERFALL**

Baseline: `main@a0566362c019be0a1b228ad76517e7bcfb3970b6`

## Purpose

Implement frozen-roadmap Phase 4.10 as a read-only observability surface for the temporal flow of real work without inventing a standalone Trace authority, causal links or timestamps that the current backend contracts do not provide.

Roadmap stages:

- Route;
- Read;
- Verify;
- Plan;
- later Human Gate;
- later Execution;
- later Post Verify.

Binding semantic rule:

`Trace / Activity = observability, not authoritative Audit.`

## Contract audit result

Current Phase 4.2 view contracts provide only partial temporal anchors.

| Stage | Current backing | Phase 4.10 behavior |
|---|---|---|
| Route | no Route/Trace event contract | Explicit `NO_ROUTE_STAGE_CONTRACT`. Work Order action, UI navigation or Agent Activity is not reclassified as a routing event. |
| Read | Finding-nested `PROVENANCE` | Display explicit observation identity, source, target, transport, read status and `observed_at` where supplied. |
| Verify | Finding-nested `EVIDENCE` / provenance verification state | Display backend verification state. Verification time remains `UNKNOWN` because there is no verification timestamp contract. |
| Plan | `PLAN` | Display Plan order identity, backend `created_at`, proposed writer and simulation-only state. |
| Finding -> Plan relationship | no explicit relationship contract | Keep `NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP`; do not attach a Plan causally to a Finding in the frontend. |
| Human Gate | no Phase-4 approval trace contract | Explicit `NO_PHASE4_APPROVAL_TRACE_CONTRACT`; non-operative. |
| Execution | not available in Phase 4 | Explicit `PHASE4_EXECUTION_NOT_AVAILABLE`. |
| Post Verify | not available in Phase 4 | Explicit `PHASE4_POST_VERIFY_NOT_AVAILABLE`. |
| Audit | `AUDIT` exists separately | Audit events are not copied into the waterfall to manufacture missing Trace relationships. |

There is still no standalone `TRACE` contract.

## Temporal semantics

The UI uses roadmap stage order as presentation structure only.

It does not:

- sort unrelated records into a causal chain;
- infer a Route event from Work Order action or UI navigation;
- infer verification time from Evidence observation time;
- infer Finding-to-Plan linkage from visual proximity;
- infer Human Gate, Execution or Post Verify state;
- use Audit event order as a substitute for a Trace relationship contract;
- promote Activity or Telemetry into authoritative workflow state.

Timestamps are shown only when a backend contract explicitly supplies them.

## Source-of-truth boundary

The Trace / Waterfall surface consumes only existing Phase 4 contracts:

- Finding-nested `PROVENANCE` for read observations;
- Finding-nested `EVIDENCE` for backend-reported verification state;
- `PLAN` for Plan identity and creation time.

No backend contract is added or weakened by this patch.

Missing authority remains visible as `UNAVAILABLE` / `UNKNOWN` with stable reasons.

## Audit separation

The existing Audit Timeline remains authoritative Audit presentation.

Phase 4.10 does not:

- copy Audit events into Trace rows;
- infer missing causal relationships from Audit sequence;
- validate the Audit hash chain in the frontend;
- reinterpret Audit payloads as UI-safe Trace data;
- expose raw Audit payloads withheld as `RAW_AUDIT_PAYLOAD_NOT_UI_SAFE`.

This preserves the roadmap rule that Trace/Activity is observability and not authoritative Audit.

## Read-only boundary

Phase 4.10 adds no operational controls and no write path.

It does not provide:

- approval controls;
- capability issuance;
- writer activation;
- execution controls;
- deploy controls;
- unlock controls;
- force actions;
- topology mutation;
- event-stream mutation.

No button or textbox is introduced by the Trace / Waterfall surface.

## Deferred scope

Phase 4.11 live event ingestion/schema safety is not pulled forward.

This patch does not select or add:

- WebSocket;
- SSE;
- another live transport;
- event sequence synthesis;
- client-side authoritative state mutation from events;
- malformed-event recovery logic;
- snapshot/resync logic.

Those remain ordered Phase 4.11+ work.

## Validation target

Before merge:

- existing backend regressions remain green;
- existing frontend regressions remain green;
- focused Phase 4.10 tests remain green;
- production frontend build succeeds;
- all seven roadmap stages remain visible without authority;
- Route remains unavailable without a Route contract;
- Read uses only Finding-nested provenance;
- Verify uses only backend-reported verification state;
- verification time remains explicit `UNKNOWN` without a timestamp contract;
- Plan remains a separate backend contract without an invented Finding relationship;
- later Human Gate / Execution / Post Verify remain non-operative and unavailable;
- Audit events are not promoted into Trace authority;
- empty Finding collections do not synthesize read or verification records;
- no operational control is introduced.

## Runtime status

This patch can become **CI VERIFIED** after pull-request CI passes.

Component tests and a production frontend build do not by themselves establish external frontend runtime verification.

The patch changes only frontend presentation/tests and documentation. It does not modify `scripts/render_read_proxy_server.py`, `src/alpha_orchestrator/render_read_proxy.py`, or their dependencies. Therefore no Render deploy is required for Phase 4.10 validation.
