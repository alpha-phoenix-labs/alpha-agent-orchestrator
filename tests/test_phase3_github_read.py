from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json

import pytest

from alpha_orchestrator.connectors import GitHubReadTransport, github_policy
from alpha_orchestrator.read_plane import ReadBroker, ReadPolicyDenied, ReadTransportError


class FakeResponse:
    def __init__(self, payload: dict, *, status: int = 200) -> None:
        self.status = status
        self.headers = {"Content-Type": "application/json; charset=utf-8"}
        self._body = json.dumps(payload).encode("utf-8")

    def read(self, limit: int) -> bytes:
        return self._body[:limit]

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


def test_github_backend_transport_forces_get_and_redacts_credential():
    captured: dict[str, object] = {}
    token = "PHASE3-SECRET-READ-TOKEN"

    def opener(request, *, timeout):
        captured["method"] = request.get_method()
        captured["authorization"] = request.get_header("Authorization")
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse({"full_name": "alpha-phoenix-labs/alpha-agent-orchestrator"})

    transport = GitHubReadTransport(token=token, opener=opener)
    broker = ReadBroker(
        policies={"github": github_policy(("alpha-phoenix-labs/alpha-agent-orchestrator",))},
        transport=transport,
    )
    observation = broker.fetch_json(
        source_id="github",
        url="https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
    )
    provenance = observation.provenance_payload(max_age_seconds=60)

    assert captured["method"] == "GET"
    assert captured["authorization"] == f"Bearer {token}"
    assert captured["url"] == observation.url
    assert token not in repr(transport)
    assert token not in repr(observation)
    assert "authorization" not in json.dumps(observation.evidence_payload()).lower()
    assert token not in json.dumps(provenance)
    assert observation.parsed_payload["full_name"] == "alpha-phoenix-labs/alpha-agent-orchestrator"

    assert provenance["source"] == "github"
    assert provenance["target_id"] == (
        "github:api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator"
    )
    assert provenance["observed_url"] == observation.url
    assert provenance["status"] == 200
    assert provenance["body_digest"] == observation.body_digest
    assert provenance["body_size"] == observation.body_size
    assert provenance["freshness_result"] == "FRESH"
    assert provenance["freshness_max_age_seconds"] == 60
    assert provenance["collector_id"] == "alpha_orchestrator.read_plane.ReadBroker"
    assert provenance["transport_id"].endswith(".GitHubReadTransport")
    assert provenance["verification_state"] == "READ_VALIDATED"


def test_github_transport_surface_does_not_accept_http_method_or_headers():
    transport = GitHubReadTransport(token="read-only", opener=lambda *args, **kwargs: None)
    with pytest.raises(TypeError):
        transport(
            url="https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
            timeout=8.0,
            method="POST",
        )
    with pytest.raises(TypeError):
        transport(
            url="https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
            timeout=8.0,
            headers={"Authorization": "caller-controlled"},
        )


def test_github_transport_missing_backend_credential_fails_closed():
    with pytest.raises(ReadTransportError, match="GITHUB_READ_CREDENTIAL_MISSING"):
        GitHubReadTransport.from_env(environ={})


def test_read_observation_freshness_accepts_current_and_rejects_stale():
    now = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)

    def opener(request, *, timeout):
        return FakeResponse({"ok": True})

    broker = ReadBroker(
        policies={"github": github_policy(("alpha-phoenix-labs/alpha-agent-orchestrator",))},
        transport=GitHubReadTransport(token="read-only", opener=opener),
    )
    observation = broker.fetch_json(
        source_id="github",
        url="https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
    )

    current = replace(observation, observed_at=now.isoformat())
    provenance = current.provenance_payload(max_age_seconds=60, now=now)
    assert provenance["freshness_result"] == "FRESH"

    stale = replace(observation, observed_at=(now - timedelta(seconds=61)).isoformat())
    with pytest.raises(ReadPolicyDenied, match="STALE_OBSERVATION"):
        stale.provenance_payload(max_age_seconds=60, now=now)

    future = replace(observation, observed_at=(now + timedelta(seconds=1)).isoformat())
    with pytest.raises(ReadPolicyDenied, match="OBSERVATION_FROM_FUTURE"):
        future.provenance_payload(max_age_seconds=60, now=now)
