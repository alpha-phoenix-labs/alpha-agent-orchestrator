from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from alpha_orchestrator.read_plane import ReadTransportError, TransportResponse


class GitHubReadTransport:
    """Backend-only GitHub REST transport with a fixed GET method.

    The credential is stored only inside the transport instance and is never returned in a
    TransportResponse. Callers can provide only URL and timeout; they cannot select an HTTP
    method or inject headers through this surface.
    """

    __slots__ = ("_token", "_opener", "_max_response_bytes")

    def __init__(
        self,
        *,
        token: str,
        opener: Callable = urlopen,
        max_response_bytes: int = 2_000_000,
    ) -> None:
        if not token:
            raise ValueError("GitHub read credential is required")
        if max_response_bytes <= 0:
            raise ValueError("max_response_bytes must be positive")
        self._token = token
        self._opener = opener
        self._max_response_bytes = max_response_bytes

    @classmethod
    def from_env(
        cls,
        *,
        environ: Mapping[str, str] | None = None,
        variable: str = "ALPHA_GITHUB_READ_TOKEN",
        opener: Callable = urlopen,
        max_response_bytes: int = 2_000_000,
    ) -> "GitHubReadTransport":
        env = os.environ if environ is None else environ
        token = env.get(variable, "")
        if not token:
            raise ReadTransportError("GITHUB_READ_CREDENTIAL_MISSING")
        return cls(token=token, opener=opener, max_response_bytes=max_response_bytes)

    def __repr__(self) -> str:
        return "GitHubReadTransport(token=<redacted>, method=GET)"

    def __call__(self, *, url: str, timeout: float) -> TransportResponse:
        request = Request(
            url=url,
            method="GET",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self._token}",
                "User-Agent": "alpha-agent-orchestrator-read-plane/0.1",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with self._opener(request, timeout=timeout) as response:
                status = int(response.status)
                headers = dict(response.headers.items())
                body = response.read(self._max_response_bytes + 1)
        except HTTPError as exc:
            body = exc.read(self._max_response_bytes + 1)
            if len(body) > self._max_response_bytes:
                raise ReadTransportError("RESPONSE_TOO_LARGE") from None
            return TransportResponse(int(exc.code), dict(exc.headers.items()), body)
        except (URLError, OSError, TimeoutError) as exc:
            raise ReadTransportError("GITHUB_READ_TRANSPORT_FAILED") from exc

        if len(body) > self._max_response_bytes:
            raise ReadTransportError("RESPONSE_TOO_LARGE")
        return TransportResponse(status, headers, body)
