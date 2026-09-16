# Go-Live Gates

No production write integration before all gates pass.

## Phase 1 — OFFLINE
- deterministic core tests pass
- no credentials
- no network writes

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
