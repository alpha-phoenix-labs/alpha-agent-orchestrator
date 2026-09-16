from __future__ import annotations

import re
from urllib.parse import urlparse

from alpha_orchestrator.read_plane import ReadPolicyDenied, ReadSourcePolicy


_RENDER_ALLOWED_PATHS = (
    re.compile(r"^/v1/services$"),
    re.compile(r"^/v1/services/[A-Za-z0-9_-]+$"),
    re.compile(r"^/v1/services/[A-Za-z0-9_-]+/deploys$"),
    re.compile(r"^/v1/services/[A-Za-z0-9_-]+/deploys/[A-Za-z0-9_-]+$"),
    re.compile(r"^/v1/postgres$"),
)


class RenderReadSourcePolicy(ReadSourcePolicy):
    """Positive Render path allowlist for non-secret metadata only.

    Prefix-only matching is insufficient for Render because sensitive read endpoints such as
    service env-vars and Postgres credentials are descendants of otherwise valid resources.
    """

    def validate_url(self, url: str) -> None:
        super().validate_url(url)
        path = urlparse(url).path.rstrip("/") or "/"
        if not any(pattern.fullmatch(path) for pattern in _RENDER_ALLOWED_PATHS):
            raise ReadPolicyDenied("RENDER_PATH_NOT_ALLOWLISTED")


def render_policy() -> ReadSourcePolicy:
    return RenderReadSourcePolicy(
        source_id="render",
        allowed_hosts=("api.render.com",),
        allowed_path_prefixes=("/v1/services", "/v1/postgres"),
        max_response_bytes=2_000_000,
        timeout_seconds=8.0,
    )
