from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))


from alpha_orchestrator.connectors import github_policy, render_policy
from alpha_orchestrator.read_plane import ReadBroker, TransportResponse
from alpha_orchestrator.shadow_read import ShadowReadService


def fake_transport(*, url, timeout):
    if "api.github.com" in url:
        body = json.dumps({"default_branch": "main", "archived": False}).encode()
    else:
        body = json.dumps({"service": {"name": "mock-service", "suspended": False}}).encode()
    return TransportResponse(200, {"Content-Type": "application/json"}, body)


broker = ReadBroker(
    policies={"github": github_policy(("example/example",)), "render": render_policy()},
    transport=fake_transport,
)
shadow = ShadowReadService(broker)

finding = shadow.inspect_json(
    reader_id="github_branch_reader",
    source_id="github",
    url="https://api.github.com/repos/example/example",
    claim_builder=lambda p: f"default_branch={p.get('default_branch')}",
)

print("MODE=READ_ONLY")
print("WRITES_ENABLED=false")
print(f"FINDING={finding.claim}")
print(f"EVIDENCE_SOURCE={finding.evidence.source}")
print(f"OBSERVATION_ID={finding.observation_id}")
print("CREDENTIALS_EXPOSED=false")
