"""Phase 3 real Render read smoke.

This script performs one authenticated GET against the allowlisted Render services endpoint.
It exposes no write method and prints provenance metadata only.
Backend-only ALPHA_RENDER_READ_TOKEN and ALPHA_RENDER_WORKSPACE_ID are required.
"""

from __future__ import annotations

import os
from urllib.parse import quote

from alpha_orchestrator.connectors import RenderReadTransport, render_policy
from alpha_orchestrator.read_plane import ReadBroker


workspace_id = os.environ.get("ALPHA_RENDER_WORKSPACE_ID", "")
if not workspace_id:
    raise SystemExit("PHASE3_RENDER_WORKSPACE_ID_MISSING")

url = f"https://api.render.com/v1/services?ownerId={quote(workspace_id, safe='')}&limit=20"
transport = RenderReadTransport.from_env()
broker = ReadBroker(policies={"render": render_policy()}, transport=transport)
observation = broker.fetch_json(source_id="render", url=url)
observation.require_fresh(max_age_seconds=60)

payload = observation.parsed_payload
if not isinstance(payload, list):
    raise SystemExit("PHASE3_RENDER_READ_PAYLOAD_SHAPE_MISMATCH")

print("PHASE3_RENDER_REAL_READ: PASS")
print("SOURCE:", observation.source_id)
print("STATUS:", observation.status)
print("OBSERVED_AT:", observation.observed_at)
print("BODY_DIGEST:", observation.body_digest)
print("BODY_SIZE:", observation.body_size)
print("SERVICE_COUNT:", len(payload))
print("WRITE_CAPABILITY_EXPOSED: false")
