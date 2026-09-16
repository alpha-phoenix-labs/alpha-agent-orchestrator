import json

import pytest

from alpha_orchestrator.read_plane import ReadBroker, ReadSourcePolicy, TransportResponse
from alpha_orchestrator.shadow_read import ShadowReadService
from alpha_orchestrator.shadow_task import ShadowReadStep, ShadowTaskRequest, ShadowTaskRunner
from alpha_orchestrator.shadow_workflow import ShadowWorkflowError


class FakeTransport:
    def __init__(self):
        self.calls = []

    def __call__(self, *, url: str, timeout: float) -> TransportResponse:
        self.calls.append((url, timeout))
        body = json.dumps({"url": url, "state": "observed"}).encode("utf-8")
        return TransportResponse(status=200, headers={"content-type": "application/json"}, body=body)


def runner():
    transport = FakeTransport()
    broker = ReadBroker(
        policies={
            "github": ReadSourcePolicy(
                source_id="github",
                allowed_hosts=("api.github.com",),
                allowed_path_prefixes=("/repos/o/r",),
            )
        },
        transport=transport,
    )
    return ShadowTaskRunner(read_service=ShadowReadService(broker)), transport


def request(*, reads=None):
    reads = reads if reads is not None else (
        ShadowReadStep(
            reader_id="github_branch_reader",
            source_id="github",
            url="https://api.github.com/repos/o/r",
            claim_builder=lambda payload: f"state={payload['state']}",
        ),
    )
    return ShadowTaskRequest(
        reads=tuple(reads),
        action="git_commit",
        target="repo://o/r/main",
        expected_effect="proposed change only",
    )


def test_request_read_verify_finding_plan_path_is_hard_no_write():
    task_runner, transport = runner()
    reviewed = []

    def reviewer(findings):
        reviewed.extend(findings)
        return True

    result = task_runner.run(request=request(), independent_reviewer=reviewer)

    assert len(transport.calls) == 1
    assert len(result.findings) == 1
    assert len(reviewed) == 1
    assert result.findings[0].provenance["verification_state"] == "READ_VALIDATED"
    assert result.plan.simulation_only is True
    assert result.plan.proposed_writer == "code_writer"
    assert result.independent_review_confirmed is True
    assert result.capabilities_issued == 0
    assert result.external_writes_performed == 0
    assert task_runner.workflow.capabilities_issued == 0
    assert task_runner.workflow.external_writes_performed == 0


def test_multiple_real_read_steps_are_bound_into_one_plan():
    task_runner, transport = runner()
    reads = (
        ShadowReadStep(
            reader_id="github_branch_reader",
            source_id="github",
            url="https://api.github.com/repos/o/r",
            claim_builder=lambda payload: "repo observed",
        ),
        ShadowReadStep(
            reader_id="ci_pipeline_reader",
            source_id="github",
            url="https://api.github.com/repos/o/r/actions",
            claim_builder=lambda payload: "ci observed",
        ),
    )
    result = task_runner.run(request=request(reads=reads), independent_reviewer=lambda findings: True)
    assert len(transport.calls) == 2
    assert len(result.findings) == 2
    assert len(result.plan.evidence) == 2


def test_disputed_independent_review_blocks_plan():
    task_runner, _ = runner()
    with pytest.raises(ShadowWorkflowError, match="INDEPENDENT_REVIEW_DISPUTED"):
        task_runner.run(request=request(), independent_reviewer=lambda findings: False)
    assert task_runner.workflow.capabilities_issued == 0
    assert task_runner.workflow.external_writes_performed == 0


def test_independent_review_result_must_be_boolean():
    task_runner, _ = runner()
    with pytest.raises(ShadowWorkflowError, match="INVALID_INDEPENDENT_REVIEW_RESULT"):
        task_runner.run(request=request(), independent_reviewer=lambda findings: "approved")


def test_shadow_task_requires_at_least_one_real_read_step():
    task_runner, transport = runner()
    with pytest.raises(ShadowWorkflowError, match="NO_READ_REQUESTS"):
        task_runner.run(request=request(reads=()), independent_reviewer=lambda findings: True)
    assert transport.calls == []


def test_shadow_task_runner_exposes_no_write_or_approval_surface():
    task_runner, _ = runner()
    assert not hasattr(task_runner, "write_proxy")
    assert not hasattr(task_runner, "approvals")
    assert not hasattr(task_runner, "acknowledge")
    assert not hasattr(task_runner, "simulate")
