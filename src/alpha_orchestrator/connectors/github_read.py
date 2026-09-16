from __future__ import annotations
from alpha_orchestrator.read_plane import ReadSourcePolicy


def github_policy() -> ReadSourcePolicy:
    # Read broker only. Concrete repository paths are still narrowed by runtime configuration.
    return ReadSourcePolicy(
        source_id="github",
        allowed_hosts=("api.github.com",),
        allowed_path_prefixes=("/repos/",),
        max_response_bytes=2_000_000,
        timeout_seconds=8.0,
    )
