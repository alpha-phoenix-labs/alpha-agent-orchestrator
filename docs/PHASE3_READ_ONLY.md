# Phase 3 — Real Read-Only Preparation

This phase prepares and validates live observation of external systems without enabling any write path.

## Security boundary

1. Agent asks for an approved logical source + URL.
2. Deterministic ReadBroker validates HTTPS, host and path allowlists.
3. Backend-only transport applies credentials.
4. Response must be 2xx JSON and below the configured size limit.
5. Agent receives parsed payload + provenance only, never the credential/header set.
6. Observation is converted to EvidenceRef for independent verification.
7. Consumers must enforce an explicit freshness window before using an observation for a decision.

## GitHub Phase-3 baseline

The GitHub baseline uses `GitHubReadTransport` behind `ReadBroker`.

The transport has these enforced properties:
- fixed HTTP method: `GET`;
- no caller method parameter;
- no caller header parameter;
- credential is injected only inside the backend transport;
- credential is redacted from transport representation and never copied into `TransportResponse` or `ReadObservation`;
- connection failures are surfaced as sanitized read-plane errors;
- response size is bounded before returning to the broker;
- GitHub host/path access remains constrained by `github_policy()` to explicit repositories.

`ReadObservation.require_fresh()` fails closed on stale, future-dated, malformed or timezone-less observation timestamps.

## Real-read smoke

`scripts/phase3_github_real_read.py` is the single-purpose acceptance smoke for GitHub. It performs exactly one authenticated GET to:

`https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator`

The script checks:
- repository identity in the returned payload;
- 2xx JSON through the broker;
- observation freshness <= 60 seconds;
- provenance fields including source, observed time, digest and body size;
- no write surface is exposed by the smoke path.

The script prints provenance metadata only; it does not print the response payload or credential.

## GitHub real-read runtime evidence

The user explicitly approved the GitHub real-read gate. A one-time validation workflow was executed from branch `phase3/real-read-validation` and then removed from the proposed persistent repository state.

Evidence:
- validation commit: `036feb0734f97c747927b5dfb43169cbf2b0a8f8`;
- workflow run: `35093964987` (`phase3-real-read-validation`);
- job: `104786641659` (`real-read`);
- result: `SUCCESS`;
- GitHub-provided token permissions in the job log: `Contents: read`, `Metadata: read`;
- checkout used `persist-credentials: false`;
- runtime mode: `READ_ONLY`;
- writes enabled: `false`;
- authenticated smoke result: `PHASE3_REAL_READ: PASS`;
- source: `github`;
- HTTP status: `200`;
- observed at: `2026-09-16T12:06:55.467828+00:00`;
- body digest: `fa1f59e4430ca5feb63f381389d6e768ed191918a10cf1112d8db832056bdb6d`;
- body size: `7731` bytes;
- reported application write surface: `WRITE_CAPABILITY_EXPOSED: false`.

No repository secret was created or changed for this validation. The credential was the ephemeral GitHub Actions token constrained by the workflow to read permissions. The token value was masked and is not recorded in repository content or evidence output.

### What this evidence proves

CONFIRMED:
- the GitHub read transport successfully performed a real authenticated GET against the allowlisted private repository;
- the broker accepted a fresh, correctly identified GitHub observation;
- the runtime path emitted provenance metadata without exposing the credential;
- the GitHub Actions credential used for this run was provider-reported as read-only for repository contents plus metadata;
- no write operation was part of the validation workflow or smoke path.

### What this evidence does not prove

NOT YET VERIFIED:
- Render real-read transport/runtime behavior;
- all future GitHub credentials will have the same permissions;
- Phase 3 as a whole is complete across every configured provider.

GitHub REAL READ-ONLY is therefore **RUNTIME VERIFIED for the validated GitHub path only**. Phase 3 remains open until the remaining configured real-read provider scope is validated or explicitly removed from Phase-3 scope.

## Activation gate

Real credentials must not be committed. Provider access used for Phase 3 must be technically non-mutating. If provider permissions cannot be made technically read-only, use a constrained proxy/connector that exposes only approved GET operations.

## Prohibited in Phase 3

- commits, PR mutations or workflow dispatches through the runtime read plane;
- Render deploy/restart/env/secret changes;
- database writes;
- generic shell or generic HTTP mutation access;
- writer credentials;
- production approval capabilities.
