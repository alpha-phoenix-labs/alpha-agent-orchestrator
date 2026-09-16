from __future__ import annotations

import re
from collections.abc import Iterable

from alpha_orchestrator.read_plane import ReadSourcePolicy


_REPO_COMPONENT = re.compile(r"^[A-Za-z0-9_.-]+$")


def github_policy(repositories: Iterable[str]) -> ReadSourcePolicy:
    repo_paths: list[str] = []
    for repository in repositories:
        parts = repository.strip("/").split("/")
        if len(parts) != 2 or not all(_REPO_COMPONENT.fullmatch(part) for part in parts):
            raise ValueError(f"Invalid GitHub repository identifier: {repository!r}")
        repo_paths.append(f"/repos/{parts[0]}/{parts[1]}")
    if not repo_paths:
        raise ValueError("At least one GitHub repository must be allowlisted")

    return ReadSourcePolicy(
        source_id="github",
        allowed_hosts=("api.github.com",),
        allowed_path_prefixes=tuple(repo_paths),
        max_response_bytes=2_000_000,
        timeout_seconds=8.0,
    )
