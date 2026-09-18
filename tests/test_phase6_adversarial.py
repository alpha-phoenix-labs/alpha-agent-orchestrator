from __future__ import annotations

import json
from pathlib import Path
import subprocess

import pytest

from alpha_orchestrator.models import OrderStatus, SystemMode
from alpha_orchestrator.sandbox_write import (
    SandboxPipeline,
    SandboxPostVerifyResult,
)
from alpha_orchestrator.view_contracts import view_payload


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def make_pipeline(tmp_path: Path) -> tuple[SandboxPipeline, Path]:
    root = tmp_path / "sandbox-root"
    root.mkdir()
    repo = root / "repo"
    repo.mkdir()
    git(repo, "init")
    git(repo, "config", "user.name", "ALPHA Phase6")
    git(repo, "config", "user.email", "phase6@invalid.local")
    (repo / "README.md").write_text("phase6 adversarial sandbox\n", encoding="utf-8")
    git(repo, "add", "README.md")
    git(repo, "commit", "-m", "phase6 baseline")
    return SandboxPipeline(root_dir=root, target_id="phase6-proof", repo_path=repo), repo


def prepare_and_approve(pipeline: SandboxPipeline, order_id: str = "WO-PHASE6-ADVERSARIAL"):
    request = pipeline.prepare_order(
        order_id=order_id,
        expected_effect="create one isolated adversarial proof commit",
    )
    assert request is not None
    approval_id = pipeline.human_approve(request, approved_by="USER_ONLY")
    return request, approval_id


def event_types(pipeline: SandboxPipeline) -> list[str]:
    return [event.event_type for event in pipeline.core.audit.events]


def test_state_version_drift_invalidates_approval_before_credential_or_write(tmp_path: Path) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")

    pipeline.core.state.update({"phase6_adversarial_drift": True})
    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "STALE_STATE"
    assert pipeline.orders[request.order_id].status == OrderStatus.BLOCKED
    assert pipeline._approval_state[request.order_id]["state"] == "INVALIDATED"
    assert git(repo, "rev-parse", "HEAD") == before
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types(pipeline)
    assert "WRITE_EXECUTION" not in event_types(pipeline)
    assert "HUMAN_APPROVAL_INVALIDATED" in event_types(pipeline)


def test_plan_change_after_approval_invalidates_without_credential_or_write(tmp_path: Path) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")

    pipeline.orders[request.order_id].expected_effect = "mutated after approval"
    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "APPROVAL_INVALIDATED"
    assert pipeline._approval_state[request.order_id]["state"] == "INVALIDATED"
    assert git(repo, "rev-parse", "HEAD") == before
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types(pipeline)
    assert "WRITE_EXECUTION" not in event_types(pipeline)


def test_emergency_freeze_after_approval_blocks_and_invalidates(tmp_path: Path) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")

    pipeline.core.emergency_freeze("PHASE6_TEST_FREEZE")
    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "MODE_BLOCKS_WRITE:EMERGENCY_FREEZE"
    assert pipeline.core.mode == SystemMode.EMERGENCY_FREEZE
    assert pipeline._approval_state[request.order_id]["state"] == "INVALIDATED"
    assert git(repo, "rev-parse", "HEAD") == before
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types(pipeline)


def test_competing_lock_blocks_before_capability_credential_or_write(tmp_path: Path) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")

    assert pipeline.core.locks.acquire(request.target, "code_writer", "WO-COMPETING")
    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "LOCK_COLLISION"
    assert git(repo, "rev-parse", "HEAD") == before
    assert request.order_id not in pipeline._capability_state
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types(pipeline)
    assert "WRITE_EXECUTION" not in event_types(pipeline)


def test_lock_loss_between_gate_and_proxy_fails_closed_without_false_consumption(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")
    original = pipeline.core.approvals.mint_capability

    def mint_then_drop_lock(*args, **kwargs):
        capability = original(*args, **kwargs)
        assert pipeline.core.locks.release(request.target, "code_writer", request.order_id)
        return capability

    monkeypatch.setattr(pipeline.core.approvals, "mint_capability", mint_then_drop_lock)

    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "LOCK_MISSING"
    assert git(repo, "rev-parse", "HEAD") == before
    assert pipeline._capability_state[request.order_id]["consumed_state"] == "ISSUED"
    assert pipeline.core.mode == SystemMode.EMERGENCY_FREEZE
    assert not (repo / ".alpha-phase5-sandbox-proof.json").exists()


def test_writer_scope_violation_fails_closed_without_consuming_capability(tmp_path: Path) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    before = git(repo, "rev-parse", "HEAD")

    result = pipeline.execute(
        order_id=request.order_id,
        approval_id=approval_id,
        writer_role="infra_writer",
    )

    assert not result.success
    assert result.detail == "WRITER_SCOPE_DENIED"
    assert pipeline._capability_state[request.order_id]["consumed_state"] == "ISSUED"
    assert git(repo, "rev-parse", "HEAD") == before
    assert pipeline.core.mode == SystemMode.EMERGENCY_FREEZE


def test_post_verify_disagreement_forces_emergency_freeze(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pipeline, repo = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)

    def disagree(*, order, execution):
        return SandboxPostVerifyResult(
            passed=False,
            reason="PHASE6_VERIFIER_DISAGREEMENT",
            observed_sha=pipeline.target.current_head(),
            artifact_digest="",
        )

    monkeypatch.setattr(pipeline.post_verifier, "verify", disagree)

    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "POST_WRITE_VERIFY_FAILED"
    assert pipeline.orders[request.order_id].status == OrderStatus.FAILED
    assert pipeline.core.mode == SystemMode.EMERGENCY_FREEZE
    assert pipeline._post_verify_state[request.order_id]["state"] == "FAILED"
    assert pipeline._post_verify_state[request.order_id]["reason"] == "PHASE6_VERIFIER_DISAGREEMENT"
    assert (repo / ".alpha-phase5-sandbox-proof.json").exists()
    assert "ORDER_DONE" not in event_types(pipeline)


def test_raw_sandbox_credential_never_reaches_audit_or_control_contracts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pipeline, _ = make_pipeline(tmp_path)
    request, approval_id = prepare_and_approve(pipeline)
    captured: list[str] = []
    original = pipeline.credentials.issue

    def capture_issue(*, order):
        credential = original(order=order)
        captured.append(credential.token)
        return credential

    monkeypatch.setattr(pipeline.credentials, "issue", capture_issue)

    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)
    assert result.success
    assert len(captured) == 1

    audit_encoded = json.dumps(
        [
            {"event_type": event.event_type, "payload": event.payload}
            for event in pipeline.core.audit.events
        ],
        sort_keys=True,
    )
    contracts_encoded = json.dumps(
        [view_payload(contract) for contract in pipeline.control_contracts(request.order_id)],
        sort_keys=True,
    )
    raw = captured[0]
    assert raw not in audit_encoded
    assert raw not in contracts_encoded
    assert '"token"' not in audit_encoded
    assert '"token"' not in contracts_encoded
