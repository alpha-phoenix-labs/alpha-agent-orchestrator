from __future__ import annotations

import json

import pytest

from alpha_orchestrator.connectors import RenderReadTransport, render_policy
from alpha_orchestrator.read_plane import ReadBroker, ReadPolicyDenied, ReadTransportError


class FakeResponse:
    def __init__(self, payload: object, *, status: int = 200) -> None:
        self.status = status
        self.headers = {"Content-Type": "application/json; charset=utf-8"}
        self._body = json.dumps(payload).encode("utf-8")

    def read(self, limit: int) -> bytes:
        return self._body[:limit]

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def test_render_backend_transport_forces_get_and_redacts_credential():
    captured: dict[str, object] = {}
    token = "PHASE3-RENDER-SECRET"

    def opener(request, *, timeout):
        captured["method"] = request.get_method()
        captured["authorization"] = request.get_header("Authorization")
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse([{"id": "srv-test", "name": "example"}])

    transport = RenderReadTransport(token=token, opener=opener)
    broker = ReadBroker(policies={"render": render_policy()}, transport=transport)
    observation = broker.fetch_json(source_id="render", url="https://api.render.com/v1/services")

    assert captured["method"] == "GET"
    assert captured["authorization"] == f"Bearer {token}"
    assert captured["url"] == observation.url
    assert token not in repr(transport)
    assert token not in repr(observation)
    assert "authorization" not in json.dumps(observation.evidence_payload()).lower()
    assert observation.parsed_payload[0]["id"] == "srv-test"


def test_render_transport_surface_does_not_accept_http_method_or_headers():
    transport = RenderReadTransport(token="read-only-boundary", opener=lambda *args, **kwargs: None)
    with pytest.raises(TypeError):
        transport(url="https://api.render.com/v1/services", timeout=8.0, method="POST")
    with pytest.raises(TypeError):
        transport(
            url="https://api.render.com/v1/services",
            timeout=8.0,
            headers={"Authorization": "caller-controlled"},
        )


def test_render_transport_missing_backend_credential_fails_closed():
    with pytest.raises(ReadTransportError, match="RENDER_READ_CREDENTIAL_MISSING"):
        RenderReadTransport.from_env(environ={})


@pytest.mark.parametrize(
    "url",
    [
        "https://api.render.com/v1/services",
        "https://api.render.com/v1/services/srv-test",
        "https://api.render.com/v1/services/srv-test/deploys",
        "https://api.render.com/v1/services/srv-test/deploys/dep-test",
        "https://api.render.com/v1/postgres",
    ],
)
def test_render_policy_allows_only_explicit_non_secret_metadata_paths(url):
    render_policy().validate_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://api.render.com/v1/services/srv-test/env-vars",
        "https://api.render.com/v1/services/srv-test/env-vars/API_KEY",
        "https://api.render.com/v1/services/srv-test/secret-files",
        "https://api.render.com/v1/postgres/dpg-test/credentials",
        "https://api.render.com/v1/postgres/dpg-test/export",
        "https://api.render.com/v1/deploys",
    ],
)
def test_render_policy_denies_sensitive_or_noncanonical_descendants(url):
    with pytest.raises(ReadPolicyDenied):
        render_policy().validate_url(url)
