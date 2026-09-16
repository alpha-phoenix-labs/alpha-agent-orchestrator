# Go-Live Gates

No production write integration before all gates pass.

## Phase 1 — OFFLINE
- deterministic core tests pass
- no credentials
- no network writes

## User-directed pre-Phase 2 hardening gate
Before Phase 2 begins, the following controls must be enforced and regression-tested:
- WriteProxy revalidates mode, writes-enabled state, current state and target lock immediately before dispatch
- execution capability is bound to the approved base-state version
- one approval and at most one execution are permitted per work order
- resource locks are derived from the exact work-order target
- Shadow plans require an explicit independent-review result
- Shadow, WriteProxy and resource scopes use one canonical action schema
- read credentials are owned only by the backend transport, never caller-supplied
- GitHub reads are limited to an explicit repository allowlist

## Phase 2 — MOCK
- mock GitHub/Render targets
- collision, stale-state, replay and scope tests pass

## Phase 3 — REAL READ-ONLY
- production-like read connectors only
- verify evidence provenance and freshness

## Phase 4 — SHADOW
- real tasks, proposed writes only
- no execution

## Phase 5 — SANDBOX WRITE
- scoped temporary credentials
- user-only human gate
- post-write verification mandatory

## Phase 6 — ADVERSARIAL ACCEPTANCE
- prompt injection
- stale SHA/state
- replayed approval
- duplicate execution
- lock race
- verifier disagreement
- writer scope violation
- control-plane outage
- emergency freeze

## Phase 7 — LIVE_GATED
Requires explicit user decision after evidence from phases 1–6.
