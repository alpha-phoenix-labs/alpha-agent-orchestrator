from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request

from alpha_orchestrator.read_plane import ReadTransportError, TransportResponse
from alpha_orchestrator.connectors.http_safety import fail_closed_urlopen


class RenderReadTransport:
    """Backend-only Render REST transport with a fixed GET method.

    Render API keys are privileged credentials, so the token remains encapsulated inside this
    transport and callers can supply only URL and timeout. The transport exposes no method or
    header override, never copies the credential into a TransportResponse, and denies redirects
    before any follow-up credentialed request can be dispatched.
    """

    __slots__ = ("_token", "_opener", "_max_response_bytes")

    def __init__(
        self,
        *,
        token: str,
        opener: Callable = fail_closed_urlopen,
        max_response_bytes: int = 2_000_000,
    ) -> None:
        if not token:
            raise ValueError("Render read credential is required")
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
        variable: str = "ALPHA_RENDER_READ_TOKEN",
        opener: Callable = fail_closed_urlopen,
        max_response_bytes: int = 2_000_000,
    ) -> "RenderReadTransport":
        env = os.environ if environ is None else environ
        token = env.get(variable, "")
        if not token:
            raise ReadTransportError("RENDER_READ_CREDENTIAL_MISSING")
        return cls(token=token, opener=opener, max_response_bytes=max_response_bytes)

    def __repr__(self) -> str:
        return "RenderReadTransport(token=<redacted>, method=GET, redirects=DENY)"

    def __call__(self, *, url: str, timeout: float) -> TransportResponse:
        request = Request(
            url=url,
            method="GET",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {self._token}",
                "User-Agent": "alpha-agent-orchestrator-read-plane/0.1",
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
            raise ReadTransportError("RENDER_READ_TRANSPORT_FAILED") from exc

        if len(body) > self._max_response_bytes:
            raise ReadTransportError("RESPONSE_TOO_LARGE")
        return TransportResponse(status, headers, body)
