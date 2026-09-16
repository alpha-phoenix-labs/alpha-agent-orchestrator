# Phase 4 — Full Shadow Mode

Phase 4 validates the complete decision path while preserving a hard no-write invariant.

## Flow

1. Read-only specialists collect observations through the read broker.
2. Evidence and independent review are required before a plan exists.
3. The control layer creates an exact plan hash and proposes a scoped writer.
4. The human authority may acknowledge that exact shadow plan.
5. The system revalidates state and simulates lock, dispatch, execution and post-write verification.
6. No execution capability is issued and no external write API is reachable from this workflow.

## Invariants

- `SYSTEM_MODE=SHADOW`
- `WRITES_ENABLED=false`
- `CAPABILITIES_ISSUED=0`
- `EXTERNAL_WRITES_PERFORMED=0`
- Unknown actions/readers fail closed.
- Plan acknowledgement is `USER_ONLY`, plan-hash-bound, and stale-state-sensitive.
- Shadow workflow imports neither `ApprovalAuthority` nor `WriteProxy`.

Phase 4 is safe to connect to real read-only sources after repository bootstrap. Writer credentials remain absent.
