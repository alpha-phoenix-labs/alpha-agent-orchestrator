from alpha_orchestrator.models import WorkOrder


def test_plan_change_changes_hash():
    a = WorkOrder(action="git_commit", target="repo:x", base_state_version="v1", expected_effect="A")
    h1 = a.plan_hash
    a.expected_effect = "B"
    assert a.plan_hash != h1
