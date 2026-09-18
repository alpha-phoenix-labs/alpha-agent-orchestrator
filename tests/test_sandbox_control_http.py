from __future__ import annotations

import json
from pathlib import Path
import subprocess

from alpha_orchestrator.operations_gateway_http import DevelopmentOperatorBearerAuthorizer
from alpha_orchestrator.sandbox_control_http import (
    SANDBOX_CONTROL_APPROVE_PATH,
    SANDBOX_CONTROL_EXECUTE_PATH,
    SANDBOX_CONTROL_STATE_PATH,
    SandboxControlHttpAdapter,
)
from alpha_orchestrator.sandbox_write import SandboxPipeline


TOKEN = "phase5-test-token"


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


def adapter(tmp_path: Path) -> tuple[SandboxControlHttpAdapter, SandboxPipeline]:
    root = tmp_path / "root"
    root.mkdir()
    repo = root / "repo"
    repo.mkdir()
    git(repo, "init")
    git(repo, "config", "user.name", "ALPHA Test")
    git(repo, "config", "user.email", "alpha-test@invalid.local")
    (repo / "README.md").write_text("sandbox\n", encoding="utf-8")
    git(repo, "add", "README.md")
    git(repo, "commit", "-m", "baseline")

    pipeline = SandboxPipeline(root_dir=root, target_id="ui-proof", repo_path=repo)
    request = pipeline.prepare_order(
        order_id="WO-PHASE5-UI-TEST",
        expected_effect="create isolated UI proof commit",
    )
    assert request is not None
    return (
        SandboxControlHttpAdapter(
            pipeline=pipeline,
            order_id=request.order_id,
            authorizer=DevelopmentOperatorBearerAuthorizer(expected_token=TOKEN),
        ),
        pipeline,
    )


def auth() -> str:
    return f"Bearer {TOKEN}"


def body(response) -> dict:
    return json.loads(response.body)


def contract(payload: dict, name: str) -> dict:
    return next(item for item in payload["contracts"] if item["contract"] == name)


def known_field(view: dict, name: str):
    field = view["fields"][name]
    assert field["available"] is True
    return field["value"]


def approval_payload(pipeline: SandboxPipeline) -> dict[str, str]:
    request = pipeline.requests["WO-PHASE5-UI-TEST"]
    return {
        "order_id": request.order_id,
        "action": request.action,
        "target": request.target,
        "base_sha": request.base_sha,
        "base_state_version": request.base_state_version,
        "plan_hash": request.plan_hash,
        "risk": request.risk,
        "confirmation": f"APPROVE {request.order_id}",
    }


def test_state_exposes_pending_backend_approval_without_invented_id(tmp_path: Path) -> None:
    http, _ = adapter(tmp_path)
    response = http.handle(
        method="GET",
        path=SANDBOX_CONTROL_STATE_PATH,
        authorization=auth(),
    )

    assert response.status == 200
    payload = body(response)
    approval = contract(payload, "APPROVAL")
    assert known_field(approval, "state") == "PENDING"
    assert approval["fields"]["approval_id"]["available"] is False
    assert approval["fields"]["approval_id"]["reason"] == "APPROVAL_ID_NOT_ISSUED"
    assert not any(item["contract"] == "CAPABILITY" for item in payload["contracts"])


def test_missing_auth_fails_closed_before_control_state(tmp_path: Path) -> None:
    http, _ = adapter(tmp_path)

    response = http.handle(
        method="GET",
        path=SANDBOX_CONTROL_STATE_PATH,
        authorization=None,
    )

    assert response.status == 401
    assert response.body == b""


def test_generic_yes_cannot_approve_high_risk_action(tmp_path: Path) -> None:
    http, pipeline = adapter(tmp_path)
    payload = approval_payload(pipeline)
    payload["confirmation"] = "YES"

    response = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_APPROVE_PATH,
        authorization=auth(),
        body=json.dumps(payload).encode(),
    )

    assert response.status == 400
    assert body(response)["error"] == "EXACT_APPROVAL_CONFIRMATION_REQUIRED"
    state = body(
        http.handle(method="GET", path=SANDBOX_CONTROL_STATE_PATH, authorization=auth())
    )
    assert known_field(contract(state, "APPROVAL"), "state") == "PENDING"


def test_approval_requires_exact_backend_binding(tmp_path: Path) -> None:
    http, pipeline = adapter(tmp_path)
    payload = approval_payload(pipeline)
    payload["plan_hash"] = "changed"

    response = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_APPROVE_PATH,
        authorization=auth(),
        body=json.dumps(payload).encode(),
    )

    assert response.status == 409
    assert body(response)["error"] == "APPROVAL_BINDING_MISMATCH"


def test_approved_state_exposes_non_secret_metadata_only(tmp_path: Path) -> None:
    http, pipeline = adapter(tmp_path)
    payload = approval_payload(pipeline)

    response = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_APPROVE_PATH,
        authorization=auth(),
        body=json.dumps(payload).encode(),
    )

    assert response.status == 200
    state = body(response)
    approval = contract(state, "APPROVAL")
    assert known_field(approval, "state") == "APPROVED"
    approval_id = known_field(approval, "approval_id")
    assert isinstance(approval_id, str) and approval_id.startswith("APR-")
    encoded = json.dumps(state)
    assert "nonce" not in encoded
    assert "token" not in encoded


def test_execute_requires_second_exact_confirmation_and_post_verify(tmp_path: Path) -> None:
    http, pipeline = adapter(tmp_path)
    approve = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_APPROVE_PATH,
        authorization=auth(),
        body=json.dumps(approval_payload(pipeline)).encode(),
    )
    approval_id = body(approve)["approval_id"]

    denied = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_EXECUTE_PATH,
        authorization=auth(),
        body=json.dumps(
            {
                "order_id": "WO-PHASE5-UI-TEST",
                "approval_id": approval_id,
                "confirmation": "EXECUTE",
            }
        ).encode(),
    )
    assert denied.status == 400
    assert body(denied)["error"] == "EXACT_EXECUTION_CONFIRMATION_REQUIRED"

    executed = http.handle(
        method="POST",
        path=SANDBOX_CONTROL_EXECUTE_PATH,
        authorization=auth(),
        body=json.dumps(
            {
                "order_id": "WO-PHASE5-UI-TEST",
                "approval_id": approval_id,
                "confirmation": "EXECUTE WO-PHASE5-UI-TEST",
            }
        ).encode(),
    )

    assert executed.status == 200
    state = body(executed)
    assert known_field(contract(state, "CAPABILITY"), "consumed_state") == "CONSUMED"
    assert known_field(contract(state, "EXECUTION"), "state") == "COMPLETED"
    assert known_field(contract(state, "POST_VERIFY"), "state") == "PASSED"
    assert known_field(contract(state, "WORK_ORDER"), "status") == "DONE"
    assert pipeline.core.audit.verify_chain()
    assert "token" not in json.dumps(state)
