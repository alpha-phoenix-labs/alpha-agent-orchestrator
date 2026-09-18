from __future__ import annotations

import json
from pathlib import Path
import subprocess

import pytest

from alpha_orchestrator.models import OrderStatus
from alpha_orchestrator.sandbox_write import (
    SandboxCredentialAuthority,
    SandboxGitTargetRegistry,
    SandboxPipeline,
)


def git(repo: Path, *args: str, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    return result.stdout.strip()


def init_repo(root: Path) -> Path:
    repo = root / "repo"
    repo.mkdir(parents=True)
    git(repo, "init")
    git(repo, "config", "user.name", "ALPHA Sandbox")
    git(repo, "config", "user.email", "sandbox@invalid.local")
    (repo / "README.md").write_text("phase5 sandbox\n", encoding="utf-8")
    git(repo, "add", "README.md")
    git(repo, "commit", "-m", "sandbox baseline")
    return repo


def make_pipeline(tmp_path: Path) -> tuple[SandboxPipeline, Path]:
    root = tmp_path / "sandbox-root"
    root.mkdir()
    repo = init_repo(root)
    pipeline = SandboxPipeline(
        root_dir=root,
        target_id="phase5-proof",
        repo_path=repo,
    )
    return pipeline, repo


def prepare(pipeline: SandboxPipeline):
    request = pipeline.prepare_order(
        order_id="WO-PHASE5-SANDBOX-001",
        expected_effect="create one isolated Phase-5 sandbox proof commit",
    )
    assert request is not None
    return request


def test_prepare_stops_at_human_gate_without_write_or_credential(tmp_path: Path):
    pipeline, repo = make_pipeline(tmp_path)
    before = git(repo, "rev-parse", "HEAD")

    request = prepare(pipeline)

    assert request.target == "sandbox-git://phase5-proof"
    assert request.base_sha == before
    assert pipeline.orders[request.order_id].status == OrderStatus.WAITING_FOR_APPROVAL
    assert git(repo, "rev-parse", "HEAD") == before
    assert not (repo / ".alpha-phase5-sandbox-proof.json").exists()
    event_types = [event.event_type for event in pipeline.core.audit.events]
    assert "HUMAN_APPROVAL_REQUESTED" in event_types
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types
    assert "WRITE_EXECUTION" not in event_types
    assert pipeline.core.audit.verify_chain()


def test_non_user_human_gate_is_denied(tmp_path: Path):
    pipeline, _ = make_pipeline(tmp_path)
    request = prepare(pipeline)

    with pytest.raises(PermissionError):
        pipeline.human_approve(request, approved_by="LEADER")


def test_full_controlled_sandbox_flow_commits_and_post_verifies(tmp_path: Path):
    pipeline, repo = make_pipeline(tmp_path)
    request = prepare(pipeline)
    before = request.base_sha

    approval_id = pipeline.human_approve(request, approved_by="USER_ONLY")
    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    after = git(repo, "rev-parse", "HEAD")
    assert result.success
    assert result.detail == "SANDBOX_EXECUTION_OK"
    assert result.output["sandbox"] is True
    assert after != before
    assert result.output["commit_sha"] == after
    assert pipeline.orders[request.order_id].status == OrderStatus.DONE
    assert pipeline.core.locks.get(request.target) is None
    assert (repo / ".alpha-phase5-sandbox-proof.json").exists()
    assert pipeline.core.audit.verify_chain()

    events = [
        {"event_type": event.event_type, "payload": event.payload}
        for event in pipeline.core.audit.events
    ]
    encoded = json.dumps(events, sort_keys=True)
    assert '"token"' not in encoded
    assert "SANDBOX_CREDENTIAL_ISSUED" in [event["event_type"] for event in events]
    assert "WRITE_EXECUTION" in [event["event_type"] for event in events]
    assert "POST_WRITE_VERIFY" in [event["event_type"] for event in events]
    assert "ORDER_DONE" in [event["event_type"] for event in events]


def test_target_outside_backend_owned_root_is_rejected(tmp_path: Path):
    root = tmp_path / "root"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    repo = init_repo(outside)
    registry = SandboxGitTargetRegistry(root_dir=root)

    with pytest.raises(ValueError, match="escapes configured root"):
        registry.register(target_id="escape", repo_path=repo)


def test_base_sha_change_after_approval_fails_before_credential_issue(tmp_path: Path):
    pipeline, repo = make_pipeline(tmp_path)
    request = prepare(pipeline)
    approval_id = pipeline.human_approve(request, approved_by="USER_ONLY")

    (repo / "drift.txt").write_text("drift\n", encoding="utf-8")
    git(repo, "add", "drift.txt")
    git(repo, "commit", "-m", "sandbox drift")

    result = pipeline.execute(order_id=request.order_id, approval_id=approval_id)

    assert not result.success
    assert result.detail == "SANDBOX_BASE_SHA_CHANGED"
    assert pipeline.orders[request.order_id].status == OrderStatus.BLOCKED
    event_types = [event.event_type for event in pipeline.core.audit.events]
    assert "SANDBOX_CREDENTIAL_ISSUED" not in event_types
    assert "WRITE_EXECUTION" not in event_types


def test_sandbox_credential_is_exact_target_bound_and_single_use(tmp_path: Path):
    pipeline, _ = make_pipeline(tmp_path)
    request = prepare(pipeline)
    order = pipeline.orders[request.order_id]
    authority = SandboxCredentialAuthority(ttl_seconds=60)
    credential = authority.issue(order=order)

    authority.consume(credential, order=order)

    with pytest.raises(PermissionError, match="already consumed"):
        authority.consume(credential, order=order)
