from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from alpha_orchestrator.models import EvidenceRef
from alpha_orchestrator.shadow_read import ShadowFinding
from alpha_orchestrator.shadow_workflow import ShadowWorkflow

wf = ShadowWorkflow()
finding = ShadowFinding(
    reader_id="github_branch_reader",
    claim="default branch observed",
    evidence=EvidenceRef(
        source="github",
        reference="https://api.github.com/repos/example/example",
        observed_at=datetime.now(timezone.utc).isoformat(),
        digest="a" * 64,
    ),
    observation_id="OBS-DEMO",
)
plan = wf.propose(
    findings=[finding],
    action="git_commit",
    target="mock://repo/main",
    expected_effect="would create a controlled commit",
    independent_review_confirmed=True,
)
ack = wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="USER_ONLY")
result = wf.simulate(order_id=plan.order_id, acknowledgement_id=ack.acknowledgement_id)

print("MODE=SHADOW")
print("WRITES_ENABLED=false")
print(f"ORDER_ID={plan.order_id}")
print(f"PLAN_HASH={plan.plan_hash}")
print(f"PROPOSED_WRITER={plan.proposed_writer}")
print(f"SIMULATION_ID={result.simulation_id}")
print(f"WOULD_EXECUTE={str(result.would_execute).lower()}")
print(f"EXTERNAL_WRITE_PERFORMED={str(result.external_write_performed).lower()}")
print(f"CAPABILITIES_ISSUED={wf.capabilities_issued}")
