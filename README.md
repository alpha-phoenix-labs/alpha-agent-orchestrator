# ALPHA Agent Orchestrator

**A security-oriented orchestration and control-plane prototype for coordinating specialist-agent workflows with constrained reads, explicit evidence, deterministic policy gates, and human-controlled change proposals.**

> **Project status: experimental / active development.** This repository is not a production-ready autonomous agent platform, a security-certified product, or a general-purpose deployment system. Its current implementation is a mixture of executable Python control-plane components, constrained read integrations, a no-write shadow workflow, a read-only React console, role definitions, tests, and phased design documentation.
>
> **Reviewed baseline:** `main@e17cbe7d46e2f4b962a4630e9e4e6addf9540450` (commit timestamp: 2026-09-17 09:23:44 UTC; repository state checked on 2026-11-04). Recheck the branch head before release if `main` has advanced.

## What this repository is

ALPHA Agent Orchestrator explores how specialist-agent work can be separated from consequential system changes. The intended control model places deterministic policy and state checks between observations and any proposed action. The user remains the designated human authority for approval.

The repository currently provides:

- a Python control-plane core with explicit system modes, work orders, state-version checks, approvals/capabilities, resource locks, guards, and a final `WriteProxy` boundary;
- mock executors and a mock workflow for testing approval and execution-control behavior without changing an external system;
- a constrained read plane with fixed-`GET` GitHub and Render transports, URL policies, bounded responses, provenance metadata, and freshness checks;
- a Shadow workflow that can turn read observations into findings and a proposed plan without issuing execution capabilities or performing external writes;
- a React/TypeScript Operations Console with read-only views for Mission Control, Work Orders, Evidence & Audit, and System / Swarm;
- agent-role descriptions, verifier descriptions, YAML control/configuration contracts, CI workflows, tests, and a phased roadmap.

## Important scope boundaries

The distinction between design, implementation, and runtime evidence is intentional.

| Area | Present in the repository | Current limitation |
|---|---|---|
| Agent roles | Markdown role definitions for a Leader, specialist readers, verifiers, and writers | These files define roles and responsibilities; they are not independently running or hosted AI agents. No LLM provider/runtime or agent-spawning service is included here. |
| Control plane | Python state, work-order, approval, capability, guard, lock, and proxy components | Core state, approvals, locks, and audit events are in-memory. They are not a durable or distributed control-plane store. |
| GitHub reads | Backend-owned fixed-`GET` transport and explicit repository policy | Read-only access only. No live GitHub write executor is implemented. |
| Render reads | Backend-owned fixed-`GET` transport, positive path allowlist, and a semantic read-proxy implementation | A Render API key may itself be privileged. The proxy constrains the application surface; it does not change provider-side key permissions. Deployment and secret-store state must be verified separately. |
| Shadow workflow | Read → provenance validation → explicit reviewer callback → proposed plan | A plan acknowledgement/simulation is not write approval and does not issue a capability. |
| Write path | Deterministic `WriteProxy` checks and isolated mock executors | The current repository does not contain production GitHub or Render write executors. Do not enable live writes based on the presence of `LIVE_GATED` as a mode constant. |
| Operations Console | React 19, TypeScript, Vite, routed read-only console and UI safety helpers | The application currently supplies no live snapshot or network transport by default. `OperationsDataProvider` starts without a snapshot, so the console renders unavailable/unknown authority until a trusted integration supplies data. |
| Live events | Backend and frontend event-envelope parsing and sequence/state-continuity checks | No WebSocket/SSE transport, live event producer, automatic snapshot refresh endpoint, or authoritative event-to-domain-state application is implemented. |

## Architecture and safety model

The intended workflow is:

```text
External systems
      |
      v
Constrained read transports (HTTPS GET, allowlisted targets)
      |
      v
ReadBroker -> Observation + provenance + freshness
      |
      v
ShadowReadService -> Finding -> independent-review result
      |
      v
ShadowWorkflow -> exact proposed plan + plan hash
      |
      v
Human review / acknowledgement (simulation only in Shadow mode)
```

A separate mock control-plane path exercises the future write lifecycle:

```text
Work Order -> verification flags -> pre-approval guard
      -> USER_ONLY approval -> short-lived capability
      -> resource lock -> WriteProxy -> MOCK executor
      -> simulated post-write verification -> in-memory audit event
```

The second diagram describes the mock control-flow implementation; it must not be read as evidence that a live provider writer is available.

### Default safety posture

The tracked example configuration sets:

- `ALPHA_SYSTEM_MODE=OFFLINE`
- `ALPHA_WRITES_ENABLED=false`
- `ALPHA_HUMAN_APPROVER_ID=USER_ONLY`
- `ALPHA_CAPABILITY_TTL_SECONDS=300`
- `ALPHA_MAX_RETRIES_PER_ORDER=2`
- `ALPHA_MAX_EXECUTIONS_PER_ORDER=1`

The control contract expresses fail-closed rules such as unknown/stale/disputed state being denied, missing evidence or locks being denied, exact approval being required, and emergency freeze overriding the normal path. YAML declarations are not, by themselves, proof that every rule is enforced by every runtime integration.

## Repository layout

```text
.
├── agents/                  # Leader, reader, verifier, and writer role definitions
├── config/                  # Control contract, policies, roles, read sources, resource scopes
├── docs/                    # Phase records, evidence matrices, threat model, roadmap, operations
├── frontend/                # React/TypeScript Operations Console and UI tests
├── scripts/                 # Local setup, mock demos, read smokes, proxy server, shadow demos
├── src/alpha_orchestrator/  # Python control plane, read plane, Shadow workflow, proxy
├── tests/                   # Python regression and security tests
├── .github/workflows/       # CI and extended validation workflows
├── ARCHITECTURE.md
├── README.md
└── SECURITY.md
```

## Technology

- **Backend:** Python 3.11+, standard-library runtime dependencies; pytest for development tests.
- **Frontend:** React 19, TypeScript, React Router, Vite, Vitest; Node.js `>=24 <25` as declared by `frontend/package.json`.
- **CI:** GitHub Actions. The base workflow tests Python and frontend behavior; the extended validation workflow also defines dependency audits, coverage checks, browser E2E, and read-only Render proxy smoke checks.

## Local development

### Python control plane

Linux / macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
python -m pytest
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
python -m pytest
```

Run the safe mock demonstration:

```bash
python scripts/mock_demo.py
```

The expected demonstration stops at `WAITING_FOR_APPROVAL` and prints that no write was executed. Its mock data is not live external evidence.

Run the read-only Shadow demonstration with a fake transport:

```bash
python scripts/shadow_read_demo.py
```

This demo uses a fake transport and sample data; it does not establish provider connectivity or production readiness. At the reviewed baseline, `scripts/shadow_workflow_demo.py` is out of sync with the `ShadowFinding` constructor/provenance contract and should be repaired before being advertised as a runnable demo.

### Frontend console

```bash
cd frontend
npm ci
npm test
npm run build
```

Start the development server with:

```bash
npm run dev
```

The console has routes for Mission Control, Work Orders, Evidence & Audit, and System / Swarm. The current `App` mounts `OperationsDataProvider` without a live snapshot source. A real backend integration and trusted snapshot/event delivery path remain separate work.

## Read-only integrations

### GitHub

The GitHub connector uses `GitHubReadTransport` behind `ReadBroker`. The transport fixes the HTTP method to `GET`, injects its credential internally, denies redirects, bounds response size, and returns response/provenance data rather than exposing its authorization header. `github_policy()` restricts access to explicitly configured repositories.

A single-purpose smoke script is provided:

```bash
ALPHA_GITHUB_READ_TOKEN=... python scripts/phase3_github_real_read.py
```

Use a least-privilege credential and inject it through a secret manager or protected runtime environment. Do not commit it, place it in frontend configuration, or paste it into issues or logs.

### Render

The Render connector uses `RenderReadTransport` and a positive path allowlist. The repository also contains `RenderReadProxy`, which exposes a semantic service-list read rather than caller-selected upstream URLs, methods, or headers. The proxy requires backend configuration:

- `ALPHA_RENDER_PROVIDER_TOKEN`
- `ALPHA_RENDER_WORKSPACE_ID`
- `ALPHA_RENDER_PROXY_TOKEN`

The direct Render smoke script uses `ALPHA_RENDER_READ_TOKEN` and `ALPHA_RENDER_WORKSPACE_ID`. Do not treat a normal Render account API key as provider-side read-only. Keep any privileged key inside the constrained backend boundary and verify its deployment and access controls independently.

The repository contains historical runtime evidence and a hosted proxy URL in validation configuration. Those records do not prove the current health, deployment revision, or secret configuration of an external Render service.

## Validation and project status

The base workflow (`.github/workflows/ci.yml`) is configured for pull requests and pushes to `main`. It runs Python tests in `OFFLINE` mode, checks the mock demonstration stops before execution, and runs frontend tests/build with Node 24.

The extended workflow (`.github/workflows/full-system-validation.yml`) defines additional checks including Python coverage (minimum 70%), `pip-audit`, `npm audit`, frontend coverage, production build, Playwright browser tests, and read-only checks against the configured Render proxy URL. Workflow definitions describe what CI is configured to do; they do not assert that the latest run passed.

### Status caveat

The repository contains phase records written at different points in the development sequence. Some current documents do not agree on whether a phase is complete or still open. For example, `docs/PHASE3_READ_ONLY.md` describes a completed, bounded read-only scope, while `docs/INTEGRATED_ROADMAP.md` records Phase 3 as in progress and `docs/PHASE3_RENDER_CREDENTIAL_GATE.md` records a separate credential/proxy gate as open. Phase 2 is likewise marked complete in the integrated roadmap while `docs/PHASE2_VALIDATION_PLAN.md` still says `IN PROGRESS`.

For that reason this README does not declare the whole roadmap complete. Treat the code and tests as implementation evidence, individual phase records as scoped/historical evidence, and open go-live gates as binding until reconciled. The roadmap places Sandbox Write, adversarial acceptance, and `LIVE_GATED` after earlier gates; this repository should not be used to perform production writes.

Start with:

- [`docs/GO_LIVE_GATES.md`](docs/GO_LIVE_GATES.md)
- [`docs/INTEGRATED_ROADMAP.md`](docs/INTEGRATED_ROADMAP.md)
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- [`SECURITY.md`](SECURITY.md)

## Security

Read [`SECURITY.md`](SECURITY.md) before configuring credentials, connecting external systems, or deploying the Render read proxy. The documented controls are not a substitute for a deployment review, secret-store review, or independent security assessment.

## License

No `LICENSE` file is present in the reviewed repository tree. Public visibility on GitHub does not itself grant permission to use, modify, or redistribute this code. Unless a license is added by the rights holder, assume that no open-source license has been granted.
