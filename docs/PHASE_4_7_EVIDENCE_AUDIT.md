# PHASE 4.7 — Evidence & Audit

Status: **PATCH PREPARED — READ-ONLY EVIDENCE & AUDIT**

Baseline: `main@252e49e3f556a5a7e16dd15b49b1f6ae8c1d6c9f`

## Purpose

Implement frozen-roadmap Phase 4.7 without introducing new authority, write capability, trace semantics or deferred graph/event infrastructure.

Required surfaces:

- Evidence Explorer;
- Findings;
- verification records;
- provenance/trace graph;
- Audit Timeline;
- Trace Inspector.

The future `APPROVAL -> CAPABILITY -> EXECUTION -> POST_VERIFY` chain is shown only as non-operative roadmap structure.

## Contract audit result

The existing Phase 4.2 contracts are sufficient for the smallest safe Phase 4.7 frontend slice:

- `EVIDENCE` supplies source, reference, observation time, digest and backend-reported verification state;
- `FINDING` supplies reader, claim, observation identity, nested Evidence, nested Provenance and an explicitly unavailable classification when no backend authority exists;
- `PROVENANCE` supplies the complete Phase-3 observation provenance record;
- `PLAN` exists, but the current contracts do not expose an explicit Finding-to-Plan relationship;
- `AUDIT` supplies sequence/event/hash identities while raw payload remains `RAW_AUDIT_PAYLOAD_NOT_UI_SAFE`.

No standalone `TRACE` contract exists. No general typed Audit/provenance relationship graph exists. The frontend therefore must not invent Request-to-Evidence, Finding-to-Plan or Audit relationship edges.

## Implementation rule

The provenance/trace surface uses only the Evidence and Provenance contracts explicitly nested inside each backend Finding contract. This establishes the already-backed Evidence/Finding observation relationship without joining independent collections by coincidence.

Where the frozen-roadmap chain requires relationships not currently modeled, the UI renders explicit `UNAVAILABLE` reasons:

- `NO_EXPLICIT_REQUEST_RELATIONSHIP`;
- `NO_EXPLICIT_FINDING_PLAN_RELATIONSHIP`.

The Trace Inspector is a provenance inspector. It does not promote Activity, Telemetry or Audit into trace authority and does not create a new domain contract.

## Audit safety

The Audit Timeline preserves backend-supplied ordering. It displays `seq`, `event_type`, `created_at`, `prev_hash` and `event_hash` as backend facts.

It does not locally verify the hash chain and does not claim durable/WORM persistence. Raw Audit payload remains unavailable whenever the backend marks it UI-unsafe.

## Security boundary

This phase does not:

- verify Evidence in the frontend;
- classify Findings in the frontend;
- calculate freshness, risk, policy or write eligibility;
- infer missing chain-of-custody relationships;
- derive authority from Telemetry or LOCAL_UI;
- add Approval, Capability, Execution, Post Verify, deploy, merge, unlock or force controls;
- add WebSocket/SSE, React Flow, Cytoscape, WebGL or another graph/runtime dependency;
- change the Render read-proxy runtime;
- expose secrets or raw sensitive Audit payloads.

## Validation target

Before merge:

- existing backend regressions remain green;
- existing frontend regressions remain green;
- focused Phase 4.7 tests remain green;
- production frontend build succeeds;
- all six required Phase 4.7 surfaces remain visible when authority is unavailable;
- backend verification state is display-only;
- Finding classification remains explicit UNKNOWN when unavailable;
- missing trace relationships remain explicit UNAVAILABLE;
- Audit payload remains withheld;
- Audit hashes are not treated as locally verified;
- future write chain remains non-operative;
- no button/textbox or operational write control is introduced.

## Runtime status

This patch can become **CI VERIFIED** after PR CI passes. It is not external frontend `RUNTIME VERIFIED` merely from component tests/build evidence.

The existing Render service runs `python scripts/render_read_proxy_server.py`. Phase 4.7 does not change that runtime path or its dependencies, so this patch does not itself require a Render deploy.
