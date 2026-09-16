from __future__ import annotations

import hmac
import json
import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import quote

from alpha_orchestrator.connectors import RenderReadTransport, render_policy
from alpha_orchestrator.read_plane import ReadBroker, ReadTransport, ReadTransportError


class RenderReadProxyError(RuntimeError):
    """Sanitized proxy failure safe for the external read-only boundary."""


class RenderReadProxyUnauthorized(RenderReadProxyError):
    pass


class RenderReadProxyConfigError(RenderReadProxyError):
    pass


@dataclass(frozen=True)
class RenderReadProxyConfig:
    provider_token: str
    workspace_id: str
    client_token: str

    @classmethod
    def from_env(
        cls,
        *,
        environ: Mapping[str, str] | None = None,
        provider_token_var: str = "ALPHA_RENDER_PROVIDER_TOKEN",
        workspace_var: str = "ALPHA_RENDER_WORKSPACE_ID",
        client_token_var: str = "ALPHA_RENDER_PROXY_TOKEN",
    ) -> "RenderReadProxyConfig":
        env = os.environ if environ is None else environ
        provider_token = env.get(provider_token_var, "")
        workspace_id = env.get(workspace_var, "")
        client_token = env.get(client_token_var, "")
        if not provider_token:
            raise RenderReadProxyConfigError("RENDER_PROXY_PROVIDER_CREDENTIAL_MISSING")
        if not workspace_id:
            raise RenderReadProxyConfigError("RENDER_PROXY_WORKSPACE_ID_MISSING")
        if not client_token:
            raise RenderReadProxyConfigError("RENDER_PROXY_CLIENT_CREDENTIAL_MISSING")
        return cls(
            provider_token=provider_token,
            workspace_id=workspace_id,
            client_token=client_token,
        )


def authorize_bearer(header_value: str | None, *, expected_token: str) -> None:
    prefix = "Bearer "
    if not expected_token or not header_value or not header_value.startswith(prefix):
        raise RenderReadProxyUnauthorized("RENDER_PROXY_UNAUTHORIZED")
    presented = header_value[len(prefix) :]
    if not hmac.compare_digest(presented, expected_token):
        raise RenderReadProxyUnauthorized("RENDER_PROXY_UNAUTHORIZED")


def collect_services_snapshot(
    *,
    provider_token: str,
    workspace_id: str,
    transport: ReadTransport | None = None,
    max_age_seconds: float = 60.0,
) -> dict[str, object]:
    """Perform exactly one allowlisted Render services read and return metadata only.

    Callers cannot supply an upstream URL, method, or authorization header. The privileged
    provider credential remains inside the proxy boundary. Raw Render service payloads are not
    returned to the proxy client; only provenance metadata and a service count are exposed.
    """

    if not workspace_id:
        raise RenderReadProxyConfigError("RENDER_PROXY_WORKSPACE_ID_MISSING")
    upstream_url = (
        "https://api.render.com/v1/services"
        f"?ownerId={quote(workspace_id, safe='')}&limit=20"
    )
    upstream_transport = (
        RenderReadTransport(token=provider_token) if transport is None else transport
    )
    broker = ReadBroker(policies={"render": render_policy()}, transport=upstream_transport)
    try:
        observation = broker.fetch_json(source_id="render", url=upstream_url)
        observation.require_fresh(max_age_seconds=max_age_seconds)
    except (ReadTransportError, ValueError) as exc:
        raise RenderReadProxyError("RENDER_PROXY_UPSTREAM_READ_FAILED") from exc

    payload = observation.parsed_payload
    if not isinstance(payload, list):
        raise RenderReadProxyError("RENDER_PROXY_PAYLOAD_SHAPE_MISMATCH")

    return {
        "source": observation.source_id,
        "status": observation.status,
        "observed_at": observation.observed_at,
        "body_digest": observation.body_digest,
        "body_size": observation.body_size,
        "service_count": len(payload),
        "write_capability_exposed": False,
    }


class RenderReadProxy:
    """Authenticated semantic read surface with no caller-selected upstream operation."""

    __slots__ = ("_config", "_transport")

    def __init__(
        self,
        *,
        config: RenderReadProxyConfig,
        transport: ReadTransport | None = None,
    ) -> None:
        self._config = config
        self._transport = transport

    @classmethod
    def from_env(
        cls,
        *,
        environ: Mapping[str, str] | None = None,
    ) -> "RenderReadProxy":
        return cls(config=RenderReadProxyConfig.from_env(environ=environ))

    def __repr__(self) -> str:
        return "RenderReadProxy(provider_token=<redacted>, client_token=<redacted>, mode=GET_ONLY)"

    def services(self, *, authorization: str | None) -> bytes:
        authorize_bearer(authorization, expected_token=self._config.client_token)
        snapshot = collect_services_snapshot(
            provider_token=self._config.provider_token,
            workspace_id=self._config.workspace_id,
            transport=self._transport,
        )
        return json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode("utf-8")
