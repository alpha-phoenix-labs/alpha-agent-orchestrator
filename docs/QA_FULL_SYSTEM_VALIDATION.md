# Full-system validation gate

Status: QA HARDENING — DEVELOPMENT ONLY

Baseline: `main@febf6cb823aefbe194d0d6b6fdd22a05716c74c4`

## Purpose

Add reproducible validation layers without changing product logic, enabling write capability, changing secrets, deploying code, or mutating production/provider state.

## Validation layers

The QA workflow validates:

- isolated Python environment installation;
- Python compile/import integrity and `pip check`;
- the complete existing Pytest suite with branch coverage and a 70% aggregate floor;
- Python dependency vulnerability auditing;
- explicit OFFLINE / writes-disabled mock behavior;
- locked frontend dependency installation;
- npm dependency auditing;
- the complete existing Vitest suite with source coverage output;
- TypeScript production typecheck/build;
- browser E2E against the built frontend in Chromium, Firefox, and WebKit/mobile viewport;
- all currently routed console surfaces;
- absence of browser page errors and operational form controls in the current read-only UI;
- read-only external Render `/healthz` contract;
- safe GET-only 404 behavior;
- a bounded eight-request, two-worker health concurrency probe.

## Safety boundary

The workflow does not:

- issue approvals or capabilities;
- enable writers;
- call authenticated provider data endpoints;
- send POST, PUT, PATCH, or DELETE requests to the Render runtime;
- mutate repositories, provider state, secrets, deployments, or infrastructure;
- deploy the QA branch;
- claim that unavailable Phase 4 authorities exist.

The Render smoke test performs only unauthenticated GET requests against the existing development read-proxy service.

## Evidence semantics

A green workflow establishes test evidence for the exact commit under test. It does not prove absence of all defects.

`FULL SYSTEM VERIFIED` in this project means that the validation layers above are reproducibly green for one exact commit while the safety boundary remains intact. It does not mean production readiness, production deployment, or authorization for real writes.
