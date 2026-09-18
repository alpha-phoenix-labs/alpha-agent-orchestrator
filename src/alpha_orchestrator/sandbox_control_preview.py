from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile

from .operations_gateway_http import DevelopmentOperatorBearerAuthorizer
from .sandbox_control_http import SandboxControlHttpAdapter
from .sandbox_write import SandboxPipeline


PHASE5_PREVIEW_TOKEN_ENV = "ALPHA_PHASE5_SANDBOX_CONTROL_TOKEN"
PHASE5_ORDER_ID = "WO-PHASE5-UI-001"
PHASE5_TARGET_ID = "phase5-ui-proof"
PHASE5_EXPECTED_EFFECT = "create one Human-Gated isolated Phase-5 UI proof commit"


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


def _bootstrap_repo(root: Path) -> Path:
    repo = root / "repo"
    repo.mkdir(parents=True)
    _git(repo, "init")
    _git(repo, "config", "user.name", "ALPHA Phase5 Preview")
    _git(repo, "config", "user.email", "phase5-preview@invalid.local")
    (repo / "README.md").write_text("phase5 sandbox control preview\n", encoding="utf-8")
    _git(repo, "add", "README.md")
    env = dict(os.environ)
    env.update(
        {
            "GIT_AUTHOR_NAME": "ALPHA Phase5 Preview",
            "GIT_AUTHOR_EMAIL": "phase5-preview@invalid.local",
            "GIT_COMMITTER_NAME": "ALPHA Phase5 Preview",
            "GIT_COMMITTER_EMAIL": "phase5-preview@invalid.local",
            "GIT_AUTHOR_DATE": "2026-09-18T10:00:00+00:00",
            "GIT_COMMITTER_DATE": "2026-09-18T10:00:00+00:00",
        }
    )
    _git(repo, "commit", "-m", "phase5 sandbox control preview baseline", env=env)
    return repo


class Phase5SandboxControlPreview:
    """Ephemeral development runtime for Phase-5 Human-Gated UI validation."""

    def __init__(self, *, token: str) -> None:
        self._tempdir = tempfile.TemporaryDirectory(prefix="alpha-phase5-control-")
        root = Path(self._tempdir.name) / "sandbox-root"
        root.mkdir()
        repo = _bootstrap_repo(root)
        self.pipeline = SandboxPipeline(
            root_dir=root,
            target_id=PHASE5_TARGET_ID,
            repo_path=repo,
        )
        request = self.pipeline.prepare_order(
            order_id=PHASE5_ORDER_ID,
            expected_effect=PHASE5_EXPECTED_EFFECT,
        )
        if request is None:
            self._tempdir.cleanup()
            raise RuntimeError("PHASE5_PREVIEW_HUMAN_GATE_PREPARATION_FAILED")
        self.adapter = SandboxControlHttpAdapter(
            pipeline=self.pipeline,
            order_id=request.order_id,
            authorizer=DevelopmentOperatorBearerAuthorizer(expected_token=token),
        )

    def close(self) -> None:
        self._tempdir.cleanup()


def build_phase5_sandbox_control_preview(*, token: str) -> Phase5SandboxControlPreview:
    return Phase5SandboxControlPreview(token=token)
