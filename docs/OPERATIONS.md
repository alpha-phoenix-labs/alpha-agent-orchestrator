# Operations Model

## User experience

The user works only with the Leader surface.

Example request:

`Check Creator for GitHub/Render collisions and prepare a safe remediation plan.`

The backend flow is:

1. Router selects relevant readers.
2. Readers gather read-only evidence.
3. Evidence Verifier checks primary-source support.
4. Independent Reviewer confirms/disputes.
5. Deterministic guards validate state and collision conditions.
6. Leader presents an exact plan hash to the user.
7. User is the only HUMAN GATE.
8. Approval mints one short-lived capability.
9. Scoped writer acts through Write Proxy.
10. Independent post-write verification closes the order.

## Human gate

A simple `Freigabe` is accepted only for the exact visible order immediately presented by the Leader. The backend must bind approval to:

- order ID
- action
- target
- base state version
- plan hash
- expiry
- nonce

Any change invalidates approval.

## Phase 2 mock validation

Run:

```bash
python -m pytest
python scripts/mock_demo.py
```

Expected behavior:

- all security and mock-flow tests pass;
- the demo stops at `WAITING_FOR_APPROVAL`;
- no live GitHub, Render, database, or production credential is configured;
- no write is executed by the demo.

### Mandatory fail-closed cases

The suite must block or freeze on:

- non-user approval attempts;
- stale state after approval;
- plan mutation after approval;
- capability replay;
- execution-id replay;
- unknown writer role;
- writer scope violation;
- disputed evidence;
- post-write verification failure;
- writes while OFFLINE/READ_ONLY/SHADOW/EMERGENCY_FREEZE.
