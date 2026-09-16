"""Phase 3 real GitHub read smoke.

This script performs exactly one authenticated GET against the allowlisted repository.
It has no write method, no writer capability, and prints only provenance metadata.
A backend-only ALPHA_GITHUB_READ_TOKEN must be provisioned before execution.
"""

from alpha_orchestrator.connectors import GitHubReadTransport, github_policy
from alpha_orchestrator.read_plane import ReadBroker


REPOSITORY = "alpha-phoenix-labs/alpha-agent-orchestrator"
URL = f"https://api.github.com/repos/{REPOSITORY}"

transport = GitHubReadTransport.from_env()
broker = ReadBroker(
    policies={"github": github_policy((REPOSITORY,))},
    transport=transport,
)
observation = broker.fetch_json(source_id="github", url=URL)
observation.require_fresh(max_age_seconds=60)

payload = observation.parsed_payload
if not isinstance(payload, dict) or payload.get("full_name") != REPOSITORY:
    raise SystemExit("PHASE3_REAL_READ_PROVENANCE_MISMATCH")

print("PHASE3_REAL_READ: PASS")
print("SOURCE:", observation.source_id)
print("STATUS:", observation.status)
print("OBSERVED_AT:", observation.observed_at)
print("BODY_DIGEST:", observation.body_digest)
print("BODY_SIZE:", observation.body_size)
print("WRITE_CAPABILITY_EXPOSED: false")
