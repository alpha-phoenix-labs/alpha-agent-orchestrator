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

## Human gate before real credential activation

A real provider credential is intentionally not committed or created by this patch.
Before the real-read smoke is executed, the user must explicitly approve provisioning/using a backend-only credential for `ALPHA_GITHUB_READ_TOKEN`.

Acceptance requires evidence that the credential/account cannot mutate the target system, or that it is reachable only through a connector/proxy that technically exposes approved GET operations. The current constrained transport supplies the GET-only application boundary, but CI tests alone do not prove provider-side credential permissions.

Until that gate is passed, Phase 3 is **PREPARED / NOT RUNTIME-VERIFIED**.

## Activation gate

Real credentials are not added until the repository and CI are green. Initial activation must use tokens/accounts that cannot mutate target systems. If provider permissions cannot be made technically read-only, use a constrained proxy/connector that exposes only approved GET operations.

## Prohibited in Phase 3

- commits, PR mutations or workflow dispatches;
- Render deploy/restart/env/secret changes;
- database writes;
- generic shell or generic HTTP mutation access;
- writer credentials;
- production approval capabilities.
