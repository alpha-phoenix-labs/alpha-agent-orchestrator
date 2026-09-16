from __future__ import annotations

import json

import pytest

from alpha_orchestrator.read_plane import ReadObservation, ReadPolicyDenied, TransportResponse
from alpha_orchestrator.render_read_proxy import (
    RenderReadProxy,
    RenderReadProxyConfig,
    RenderReadProxyConfigError,
    RenderReadProxyError,
    RenderReadProxyUnauthorized,
    authorize_bearer,
    collect_services_snapshot,
)


class RecordingTransport:
    def __init__(self, body: bytes = b'[{"id":"srv-1"}]') -> None:
        self.body = body
        self.calls: list[tuple[str, float]] = []

    def __call__(self, *, url: str, timeout: float) -> TransportResponse:
        self.calls.append((url, timeout))
        return TransportResponse(
            200,
            {"Content-Type": "application/json"},
            self.body,
        )


def test_proxy_config_fails_closed_when_any_secret_or_workspace_value_is_missing():
    with pytest.raises(RenderReadProxyConfigError, match="PROVIDER_CREDENTIAL_MISSING"):
        RenderReadProxyConfig.from_env(environ={})
    with pytest.raises(RenderReadProxyConfigError, match="WORKSPACE_ID_MISSING"):
        RenderReadProxyConfig.from_env(environ={"ALPHA_RENDER_PROVIDER_TOKEN": "provider"})
    with pytest.raises(RenderReadProxyConfigError, match="CLIENT_CREDENTIAL_MISSING"):
        RenderReadProxyConfig.from_env(
            environ={
                "ALPHA_RENDER_PROVIDER_TOKEN": "provider",
                "ALPHA_RENDER_WORKSPACE_ID": "workspace",
            }
        )


def test_bearer_auth_is_exact_and_sanitized():
    secret = "CLIENT-SECRET-VALUE"
    with pytest.raises(RenderReadProxyUnauthorized) as exc_info:
        authorize_bearer("Bearer wrong", expected_token=secret)
    assert secret not in str(exc_info.value)
    authorize_bearer(f"Bearer {secret}", expected_token=secret)


def test_services_snapshot_uses_fixed_allowlisted_upstream_and_returns_metadata_only():
    transport = RecordingTransport()
    snapshot = collect_services_snapshot(
        provider_token="PROVIDER-SECRET",
        workspace_id="tea-work space",
        transport=transport,
    )

    assert len(transport.calls) == 1
    url, timeout = transport.calls[0]
    assert url == "https://api.render.com/v1/services?ownerId=tea-work%20space&limit=20"
    assert timeout == 8.0
    assert snapshot["source"] == "render"
    assert snapshot["target_id"] == (
        "render:api.render.com/v1/services?ownerId=tea-work%20space&limit=20"
    )
    assert snapshot["observed_url"] == url
    assert snapshot["status"] == 200
    assert snapshot["freshness_result"] == "FRESH"
    assert snapshot["freshness_max_age_seconds"] == 60.0
    assert snapshot["collector_id"] == "alpha_orchestrator.read_plane.ReadBroker"
    assert snapshot["transport_id"].endswith(".RecordingTransport")
    assert snapshot["verification_state"] == "READ_VALIDATED"
    assert snapshot["service_count"] == 1
    assert snapshot["write_capability_exposed"] is False
    assert "PROVIDER-SECRET" not in json.dumps(snapshot)
    assert "srv-1" not in json.dumps(snapshot)


def test_services_snapshot_sanitizes_freshness_policy_failure(monkeypatch):
    def reject_freshness(self, *, max_age_seconds, now=None):
        raise ReadPolicyDenied("STALE_OBSERVATION")

    monkeypatch.setattr(ReadObservation, "require_fresh", reject_freshness)

    with pytest.raises(RenderReadProxyError, match="RENDER_PROXY_UPSTREAM_READ_FAILED") as exc_info:
        collect_services_snapshot(
            provider_token="PROVIDER-SECRET",
            workspace_id="tea-workspace",
            transport=RecordingTransport(),
        )

    assert "STALE_OBSERVATION" not in str(exc_info.value)
    assert "PROVIDER-SECRET" not in str(exc_info.value)


def test_proxy_client_receives_no_provider_credential_or_raw_payload():
    config = RenderReadProxyConfig(
        provider_token="PROVIDER-SECRET",
        workspace_id="tea-workspace",
        client_token="CLIENT-SECRET",
    )
    proxy = RenderReadProxy(config=config, transport=RecordingTransport())
    body = proxy.services(authorization="Bearer CLIENT-SECRET")
    decoded = body.decode("utf-8")

    assert "PROVIDER-SECRET" not in decoded
    assert "CLIENT-SECRET" not in decoded
    assert "srv-1" not in decoded
    assert '"freshness_result":"FRESH"' in decoded
    assert '"verification_state":"READ_VALIDATED"' in decoded
    assert '"write_capability_exposed":false' in decoded
    assert "token=<redacted>" in repr(proxy)
