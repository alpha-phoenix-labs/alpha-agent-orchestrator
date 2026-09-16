# ALPHA Agent Orchestrator

Zero-trust multi-agent control plane for ALPHA operations.

**Purpose:** one user-facing Leader channel, multiple read-only specialist agents, independent verification, deterministic safety gates, and two narrowly scoped writers behind a human-only approval gate.

## Safety defaults

- Default mode: `OFFLINE`
- Writes: disabled by default
- Human approval: required for every real write
- Reader agents: read-only by design
- Leader: no direct write capability
- Writers: isolated scopes; no direct communication with readers or each other
- All writes pass through the deterministic Write Proxy
- State changes invalidate approvals
- Resource locks are mandatory before execution
- Audit log is append-only and hash-chained

## Repository status

This scaffold is intentionally isolated. It contains no production credentials, no live GitHub/Render integration, and no connection to existing Creator services.

Start with [`docs/SETUP_AFTER_REPO.md`](docs/SETUP_AFTER_REPO.md).

## Phase 3 — Shadow Read Plane

Version 0.3 adds a deterministic HTTPS GET-only read broker for future GitHub and Render observations.
It is safe to prepare before credentials exist:

- no generic HTTP method is exposed to agents;
- sources, hosts and path prefixes are allowlisted;
- non-HTTPS, non-2xx, non-JSON and oversized responses fail closed;
- credentials remain backend-only and never enter observations/evidence;
- the ShadowReadService has no approval or write execution surface;
- live credentials are intentionally absent from this scaffold.

Run `python scripts/shadow_read_demo.py` after local setup to verify the read-only path with a fake transport.


## Phase 4 — Full Shadow Mode

The v0.4 scaffold adds a complete no-write shadow lifecycle. Real read-only findings can be verified, converted into an exact plan, acknowledged only by the configured human authority, and simulated through the writer path without issuing capabilities or performing external writes. See `docs/PHASE4_SHADOW_MODE.md`.
