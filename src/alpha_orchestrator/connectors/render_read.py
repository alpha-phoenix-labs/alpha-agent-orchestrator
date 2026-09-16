from __future__ import annotations
from alpha_orchestrator.read_plane import ReadSourcePolicy


def render_policy() -> ReadSourcePolicy:
    # Read broker only. No deploy, env, secret or mutation endpoints are exposed here.
    return ReadSourcePolicy(
        source_id="render",
        allowed_hosts=("api.render.com",),
        allowed_path_prefixes=("/v1/services", "/v1/deploys", "/v1/postgres"),
        max_response_bytes=2_000_000,
        timeout_seconds=8.0,
    )
