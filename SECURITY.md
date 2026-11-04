# Security Policy

## Project security status

ALPHA Agent Orchestrator is an experimental security-oriented orchestration prototype under active development. It is **not security-certified, not independently audited, and not approved for production write operations**.

**Reviewed baseline:** `main@e17cbe7d46e2f4b962a4630e9e4e6addf9540450` (commit timestamp: 2026-09-17 09:23:44 UTC; repository state checked on 2026-11-04). Revalidate the exact branch head and runtime before release.

This policy describes security-relevant controls visible in the repository. It does not guarantee that every control is active in every deployment or that external infrastructure is configured correctly.

## Reporting a vulnerability

Please do not publish an unpatched vulnerability, credential, exploit detail, or sensitive reproduction data in a public issue.

Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If it is not enabled, contact the repository maintainers privately through a verified contact channel associated with the repository. Include the affected revision, component, impact, and a minimal reproduction that does not contain real secrets or personal data.

Do not test against systems, accounts, workspaces, or deployments unless you own them or have explicit authorization.

## Security objectives

The design objective is that a single AI agent cannot independently authorize and perform a consequential external change. The intended control path separates:

1. observations from external systems;
2. evidence/provenance and independent review;
3. deterministic state, policy, scope, and lock checks;
4. the human approval boundary;
5. narrowly scoped execution;
6. post-action verification and audit records.

The current code implements only part of this end-to-end model. In particular, the write path is mock-only and the control-plane persistence is in-memory.

## Controls present in the repository

### Read-plane restrictions

- GitHub and Render transports fix the HTTP method to `GET`; callers do not supply a method or authorization-header override through the transport call surface.
- Credentials are injected inside backend transport objects and are not intentionally copied into observations or transport response objects.
- GitHub access is constrained by HTTPS host and explicit repository path policies.
- Render access uses a positive path allowlist for selected service/deploy/Postgres metadata routes. Sensitive descendants such as service environment-variable and credential/export paths are excluded.
- Credentialed redirects are rejected by a fail-closed redirect handler.
- Response size is bounded by the transport; the read plane validates status/content and produces observation/provenance metadata.
- Freshness checks reject malformed, timezone-less, stale, or future-dated timestamps.

### Shadow-mode restrictions

- `ShadowTaskRunner` delegates reads to `ShadowReadService` and plan creation to `ShadowWorkflow`.
- Shadow plan creation requires a non-empty finding set, allowed reader identifiers, provenance fields, fresh timestamps, and an explicit boolean independent-review result.
- The Shadow runner has no acknowledgement, capability-minting, `WriteProxy`, or executor interface.
- The Shadow workflow represents proposed writers as plan metadata and reports zero capabilities and zero external writes for its simulation path.

### Mock control-plane restrictions

- The control contract sets `OFFLINE` as the default mode and writes disabled by default.
- The control-plane code checks mode, write-enabled state, state version, lock ownership, approval binding, capability expiry, writer scope, capability replay, execution-id replay, and an execution limit before mock executor dispatch.
- `scripts/mock_demo.py` intentionally stops at the human-approval request and does not execute a write.
- The mock workflow uses mock GitHub/Render target functions; it does not mutate real providers.

### Frontend presentation safeguards

- The console consumes typed view-contract shapes and distinguishes unavailable values from available values.
- Backend view-contract code explicitly leaves some facts unavailable when no authoritative source exists, including lifecycle stage, Finding classification, Agent/Connector runtime facts, and telemetry.
- The UI does not define a live WebSocket/SSE transport or backend event producer.
- Frontend secret-redaction helpers sanitize known sensitive field names and several common secret-like string patterns before values are exposed to view components.
- UI redaction is a defensive presentation layer, not a replacement for backend credential isolation or secret management.

## Important limitations and non-claims

The following limitations are material and must not be hidden behind the phrase “zero trust.”

### 1. No production write integration

`WriteProxy` currently dispatches only executors explicitly registered in process; the repository's workflow registers mock executors. There is no production GitHub commit/merge executor or Render deploy/configuration executor in the reviewed code. The presence of action names, resource-scope declarations, or the `LIVE_GATED` enum value does not establish a usable or approved live writer.

Do not enable live writes or connect production write credentials based on the current scaffold.

### 2. In-memory control-plane state

The current implementations of `StateStore`, `ResourceLockManager`, `ApprovalAuthority`, and `AuditLog` are process-local/in-memory components. They do not provide durable persistence, cross-process coordination, distributed locking, or restart-safe approval state. A process restart loses their state.

### 3. Audit chain is not durable or independently anchored

`AuditLog` builds an in-memory SHA-256 hash chain over JSON-serialized event data. This is useful for local integrity checks but is not WORM storage, an external timestamping service, a signed audit ledger, or a tamper-proof durable evidence store. It should not be described as immutable or production-grade audit retention.

The serializer uses sorted-key JSON output; it is not a formal RFC 8785/JCS implementation. No external anchoring or signing key management is present in this audit implementation.

### 4. Human identity is not integrated

`USER_ONLY` is a configured identifier/string checked by the current Python approval code. The repository does not provide a complete authenticated identity-provider integration, MFA enforcement, or proof that a real interactive approval was performed by a particular person. The approval classes demonstrate binding and single-use mechanics; they are not a production authorization service.

### 5. Mock verification is not a production evidence verifier

The mock workflow is designed to exercise the control path. Its mock report verification checks basic presence and can be forced into a dispute; it is not a full semantic or cryptographic independent review of arbitrary external evidence. `OrchestratorCore.mark_verified()` sets verification flags within the mock control flow. Do not treat these functions as a production independent-verification service.

### 6. Locks and state checks are not distributed

Resource locks use an in-process mutex and dictionary. They do not coordinate multiple application instances or provide transactional guarantees against cross-process races. The in-memory state store is also not a production source of canonical external state.

### 7. Render provider credentials may be privileged

A Render account API key must be treated as a privileged credential unless provider-side permissions prove otherwise. The repository's fixed-GET transport and constrained semantic proxy reduce the reachable application surface; they do not convert a broadly privileged provider key into a provider-native read-only identity. Keep the provider key isolated inside the proxy runtime and restrict access to the proxy's client credential.

The repository contains historical Render runtime evidence and a hosted proxy URL in a validation workflow. Current deployment health, revision, environment variables, secret bindings, access policy, and provider-side identity were not independently inspected as part of this repository review.

### 8. The frontend is not connected to an authoritative live backend by default

The current `App` mounts `OperationsDataProvider` without a snapshot source or resilience/transport adapter. The console therefore has no default live data feed. The event parsers validate envelopes, but they do not establish a transport, fetch snapshots, or apply event payloads to authoritative domain state.

### 9. Secret redaction is not comprehensive secret detection

Frontend redaction covers known field names and common token/string patterns. Pattern-based filtering cannot guarantee detection of every secret, proprietary value, encoding, or novel credential format. Secrets must be prevented from entering observations, logs, snapshots, audit payloads, and client responses in the first place.

### 10. One Shadow demo is out of sync with its current contract

At the reviewed baseline, `scripts/shadow_workflow_demo.py` constructs `ShadowFinding` without the required `provenance` argument. The current dataclass requires that field, and the Shadow workflow additionally validates a full provenance contract. Treat this helper as broken until the script and its expected evidence payload are updated and tested.

### 11. Role files are definitions, not isolated agent processes

The `agents/` directory describes Leader, Reader, Verifier, and Writer responsibilities. It does not itself provide process isolation, sandboxing, model authorization, tool-call mediation, or runtime enforcement of agent-to-agent communication. YAML role and scope declarations must be checked against actual runtime enforcement before being treated as security boundaries.

### 12. Deployment and repository administration are outside the tracked tree

A source-tree review cannot establish the contents of GitHub Actions secrets, environment protection rules, branch protection/rulesets, organization policy, Render secret values, deployed revision, network policy, or account-level access. These must be reviewed separately by an authorized maintainer.

## Required operating precautions

Until the missing production controls are implemented and independently validated:

- keep `ALPHA_SYSTEM_MODE=OFFLINE` unless a specific read-only or mock validation requires another mode;
- keep `ALPHA_WRITES_ENABLED=false`;
- do not provision production write credentials;
- use a dedicated, least-privilege read identity wherever the provider supports one;
- treat any Render provider key as privileged and keep it only inside the constrained backend proxy boundary;
- never commit `.env` files, tokens, cookies, private keys, capability values, or credential-bearing exports;
- do not pass secrets through frontend props, snapshots, URLs, logs, traces, or error messages;
- use only approved repositories, workspaces, and external targets;
- do not perform live security testing or write tests against third-party systems without authorization;
- do not interpret a passing unit/component test as production deployment evidence.

## Public-repository release checklist

Before and after making the repository public, maintainers should independently verify:

- [ ] The complete Git history has been scanned for secrets, not just the current `main` tree.
- [ ] Any exposed or suspected credential has been revoked and rotated; deleting it from the current tree is not sufficient.
- [ ] GitHub Actions secrets, repository environments, deployment credentials, and protected-environment approvals have been reviewed in GitHub settings.
- [ ] Branch protection/rulesets and required CI checks are configured as intended.
- [ ] Render service environment variables, provider keys, client proxy tokens, and deployed revision have been reviewed without exposing values in logs or evidence.
- [ ] No personal data, private customer data, internal endpoint, non-public architecture, or third-party proprietary material is unintentionally present in the current tree or history.
- [ ] The repository's license and ownership position have been decided. No `LICENSE` file was present in the reviewed tree; making a repository public does not itself grant an open-source license.
- [ ] The README, phase records, and roadmap describe current implementation and open gates consistently.

## CI and validation boundaries

The base GitHub Actions workflow grants `contents: read`, runs the Python test suite with `OFFLINE` and writes disabled, checks that the mock demo stops before execution, and runs frontend tests and a production build.

The extended validation workflow defines additional checks including Python coverage, `pip-audit`, frontend `npm audit`, browser E2E, and GET-only smoke checks against a configured Render proxy URL. These workflow definitions are not proof that the latest execution passed. Review the actual workflow run, revision, logs, and artifacts before making a validation claim.

## Roadmap / go-live boundary

`docs/GO_LIVE_GATES.md` defines later Sandbox Write, Adversarial Acceptance, and `LIVE_GATED` phases. The integrated roadmap and individual phase records contain status inconsistencies. A scoped phase document must not be used to override an open credential, deployment, or go-live gate. Resolve the status conflicts with current code, current tests, PR/CI evidence, and runtime evidence before any change in operating mode.

No production write authorization is granted by this policy.
