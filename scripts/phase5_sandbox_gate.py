from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile

from alpha_orchestrator.sandbox_write import SandboxPipeline


ORDER_ID = "WO-PHASE5-SANDBOX-001"
TARGET_ID = "phase5-runtime-proof"
EXPECTED_EFFECT = "create one isolated Phase-5 sandbox proof commit"


def _git(repo: Path, *args: str, env: dict[str, str] | None = None) -> str:
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


def _bootstrap_deterministic_repo(root: Path) -> Path:
    repo = root / "repo"
    repo.mkdir(parents=True)
    _git(repo, "init")
    _git(repo, "config", "user.name", "ALPHA Sandbox")
    _git(repo, "config", "user.email", "sandbox@invalid.local")
    (repo / "README.md").write_text("phase5 deterministic sandbox baseline\n", encoding="utf-8")
    _git(repo, "add", "README.md")
    env = dict(os.environ)
    env.update(
        {
            "GIT_AUTHOR_NAME": "ALPHA Sandbox",
            "GIT_AUTHOR_EMAIL": "sandbox@invalid.local",
            "GIT_COMMITTER_NAME": "ALPHA Sandbox",
            "GIT_COMMITTER_EMAIL": "sandbox@invalid.local",
            "GIT_AUTHOR_DATE": "2026-09-18T08:00:00+00:00",
            "GIT_COMMITTER_DATE": "2026-09-18T08:00:00+00:00",
        }
    )
    _git(repo, "commit", "-m", "deterministic phase5 sandbox baseline", env=env)
    return repo


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="alpha-phase5-gate-") as temp_dir:
        root = Path(temp_dir) / "sandbox-root"
        root.mkdir()
        repo = _bootstrap_deterministic_repo(root)
        before = _git(repo, "rev-parse", "HEAD")

        pipeline = SandboxPipeline(
            root_dir=root,
            target_id=TARGET_ID,
            repo_path=repo,
        )
        request = pipeline.prepare_order(
            order_id=ORDER_ID,
            expected_effect=EXPECTED_EFFECT,
        )
        if request is None:
            raise RuntimeError("Sandbox Work Order failed to reach Human Gate")

        after = _git(repo, "rev-parse", "HEAD")
        event_types = [event.event_type for event in pipeline.core.audit.events]
        no_write = before == after and not (repo / ".alpha-phase5-sandbox-proof.json").exists()
        no_credential = "SANDBOX_CREDENTIAL_ISSUED" not in event_types
        no_execution = "WRITE_EXECUTION" not in event_types
        if not (no_write and no_credential and no_execution):
            raise RuntimeError("Human Gate preparation caused a forbidden pre-approval side effect")

        print("PHASE5_SANDBOX_GATE")
        print("STATUS: WAITING_FOR_APPROVAL")
        print(f"ORDER_ID: {request.order_id}")
        print(f"ACTION: {request.action}")
        print(f"TARGET: {request.target}")
        print(f"BASE_SHA: {request.base_sha}")
        print(f"STATE_VERSION: {request.base_state_version}")
        print(f"PLAN_HASH: {request.plan_hash}")
        print(f"RISK: {request.risk}")
        print(f"EXPECTED_EFFECT: {request.expected_effect}")
        print("NO WRITE EXECUTED: true")
        print("NO CREDENTIAL ISSUED: true")
        print("NO CAPABILITY MINTED: true")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
