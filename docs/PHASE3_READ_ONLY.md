# Phase 3 — Real Read-Only Preparation

This phase prepares, but does not activate, live observation of external systems.

## Security boundary

1. Agent asks for an approved logical source + URL.
2. Deterministic ReadBroker validates HTTPS, host and path allowlists.
3. Backend-only transport applies credentials.
4. Response must be 2xx JSON and below the configured size limit.
5. Agent receives parsed payload + provenance only, never the credential/header set.
6. Observation is converted to EvidenceRef for independent verification.

## Activation gate

Real credentials are not added until the repository exists and CI is green. Initial activation must use tokens/accounts that cannot mutate target systems. If provider permissions cannot be made technically read-only, use a constrained proxy/connector that exposes only approved GET operations.

## Prohibited in Phase 3

- commits, PR mutations or workflow dispatches;
- Render deploy/restart/env/secret changes;
- database writes;
- generic shell or generic HTTP mutation access;
- writer credentials;
- production approval capabilities.
