"""Safe demo: runs only to the human gate and performs no execution."""
from alpha_orchestrator.mock_workflow import MockPipeline, ReaderReport


pipeline = MockPipeline()
report = ReaderReport(
    reader_id="github_branch_reader",
    claim="Mock branch divergence detected",
    source="MOCK_GITHUB",
    reference="mock/repo/main",
    observed_payload={"sha": "abc123", "observed_at": "MOCK"},
)
request = pipeline.prepare_order(
    reports=[report],
    action="git_commit",
    target="mock://repo/main",
    expected_effect="simulated commit only",
)

print("MODE:", pipeline.core.mode.value)
print("NO REAL INTEGRATIONS: true")
if request is None:
    print("RESULT: BLOCKED BEFORE HUMAN GATE")
else:
    print("RESULT: WAITING_FOR_APPROVAL")
    print("ORDER_ID:", request.order_id)
    print("PLAN_HASH:", request.plan_hash)
    print("No write was executed.")
