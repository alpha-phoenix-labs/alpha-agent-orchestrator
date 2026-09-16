from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json

import pytest

from alpha_orchestrator.connectors import github_policy, render_policy
from alpha_orchestrator.read_plane import (
    ReadBroker,
    ReadPolicyDenied,
    ReadTransportError,
    TransportResponse,
)
from alpha_orchestrator.shadow_read import ShadowReadService


def ok_transport(*, url, timeout):
    body = json.dumps({"ok": True, "url": url}).encode()
    return TransportResponse(200, {"Content-Type": "application/json; charset=utf-8"}, body)


def broker(transport=ok_transport):
    return ReadBroker(
        policies={"github": github_policy(("o/r",)), "render": render_policy()},
        transport=transport,
    )


def test_github_allowlisted_get_succeeds_and_has_provenance():
    obs = broker().fetch_json(source_id="github", url="https://api.github.com/repos/o/r")
    provenance = obs.provenance_payload(max_age_seconds=60)

    assert obs.status == 200
    assert obs.source_id == "github"
    assert len(obs.body_digest) == 64
    assert obs.body_size > 0
    assert provenance["source"] == "github"
    assert provenance["target_id"] == "github:api.github.com/repos/o/r"
    assert provenance["observed_url"] == "https://api.github.com/repos/o/r"
    assert provenance["freshness_result"] == "FRESH"
    assert provenance["collector_id"] == "alpha_orchestrator.read_plane.ReadBroker"
    assert provenance["verification_state"] == "READ_VALIDATED"


def test_unknown_source_denied():
    with pytest.raises(ReadPolicyDenied, match="UNKNOWN_SOURCE"):
        broker().fetch_json(source_id="unknown", url="https://api.github.com/repos/o/r")


def test_http_denied():
    with pytest.raises(ReadPolicyDenied, match="HTTPS_REQUIRED"):
        broker().fetch_json(source_id="github", url="http://api.github.com/repos/o/r")


def test_non_allowlisted_host_denied():
    with pytest.raises(ReadPolicyDenied, match="HOST_NOT_ALLOWLISTED"):
        broker().fetch_json(source_id="github", url="https://evil.example/repos/o/r")


def test_non_allowlisted_path_denied():
    with pytest.raises(ReadPolicyDenied, match="PATH_NOT_ALLOWLISTED"):
        broker().fetch_json(source_id="github", url="https://api.github.com/user")


def test_non_allowlisted_repository_denied():
    with pytest.raises(ReadPolicyDenied, match="PATH_NOT_ALLOWLISTED"):
        broker().fetch_json(source_id="github", url="https://api.github.com/repos/o/other")


def test_repository_prefix_collision_denied():
    with pytest.raises(ReadPolicyDenied, match="PATH_NOT_ALLOWLISTED"):
        broker().fetch_json(source_id="github", url="https://api.github.com/repos/o/r-evil")


def test_url_embedded_credentials_denied():
    with pytest.raises(ReadPolicyDenied, match="CREDENTIALS_IN_URL_FORBIDDEN"):
        broker().fetch_json(source_id="github", url="https://x:y@api.github.com/repos/o/r")


def test_non_2xx_fails_closed():
    def transport(**kwargs):
        return TransportResponse(403, {"Content-Type": "application/json"}, b'{"error":"no"}')

    with pytest.raises(ReadTransportError, match="NON_SUCCESS_STATUS:403"):
        broker(transport).fetch_json(source_id="github", url="https://api.github.com/repos/o/r")


def test_non_json_fails_closed():
    def transport(**kwargs):
        return TransportResponse(200, {"Content-Type": "text/html"}, b"<html></html>")

    with pytest.raises(ReadTransportError, match="JSON_CONTENT_TYPE_REQUIRED"):
        broker(transport).fetch_json(source_id="github", url="https://api.github.com/repos/o/r")


def test_invalid_json_fails_closed():
    def transport(**kwargs):
        return TransportResponse(200, {"Content-Type": "application/json"}, b"not-json")

    with pytest.raises(ReadTransportError, match="INVALID_JSON_RESPONSE"):
        broker(transport).fetch_json(source_id="github", url="https://api.github.com/repos/o/r")


def test_response_size_limit_enforced():
    pol = github_policy(("o/r",))
    tiny = type(pol)(
        pol.source_id,
        pol.allowed_hosts,
        pol.allowed_path_prefixes,
        max_response_bytes=3,
        timeout_seconds=pol.timeout_seconds,
    )
    b = ReadBroker(policies={"github": tiny}, transport=ok_transport)
    with pytest.raises(ReadTransportError, match="RESPONSE_TOO_LARGE"):
        b.fetch_json(source_id="github", url="https://api.github.com/repos/o/r")


def test_transport_exception_is_sanitized():
    def transport(**kwargs):
        raise RuntimeError("Authorization: Bearer SUPERSECRET")

    with pytest.raises(ReadTransportError) as exc:
        broker(transport).fetch_json(source_id="github", url="https://api.github.com/repos/o/r")
    assert "SUPERSECRET" not in str(exc.value)
    assert str(exc.value) == "READ_TRANSPORT_FAILED"


def test_credentials_are_backend_transport_only():
    token = "SECRET-TOKEN-123"

    def authenticated_transport(*, url, timeout):
        assert token == "SECRET-TOKEN-123"
        body = json.dumps({"ok": True}).encode()
        return TransportResponse(200, {"Content-Type": "application/json"}, body)

    b = broker(authenticated_transport)
    obs = b.fetch_json(source_id="github", url="https://api.github.com/repos/o/r")
    assert token not in repr(obs)
    shadow = ShadowReadService(b)
    finding = shadow.inspect_json(
        reader_id="github_branch_reader",
        source_id="github",
        url="https://api.github.com/repos/o/r",
        claim_builder=lambda payload: payload["ok"],
    )
    assert token not in repr(finding)
    assert finding.provenance["freshness_result"] == "FRESH"
    assert finding.provenance["verification_state"] == "READ_VALIDATED"


def test_shadow_service_rejects_stale_observation_before_claim_builder():
    now = datetime.now(timezone.utc)
    fresh = broker().fetch_json(source_id="github", url="https://api.github.com/repos/o/r")
    stale = replace(fresh, observed_at=(now - timedelta(seconds=61)).isoformat())

    class StaleBroker:
        def fetch_json(self, *, source_id, url):
            return stale

    claim_called = False

    def claim_builder(payload):
        nonlocal claim_called
        claim_called = True
        return payload["ok"]

    service = ShadowReadService(StaleBroker(), max_age_seconds=60)
    with pytest.raises(ReadPolicyDenied, match="STALE_OBSERVATION"):
        service.inspect_json(
            reader_id="github_branch_reader",
            source_id="github",
            url="https://api.github.com/repos/o/r",
            claim_builder=claim_builder,
        )

    assert claim_called is False


def test_caller_cannot_supply_headers():
    with pytest.raises(TypeError):
        broker().fetch_json(
            source_id="github",
            url="https://api.github.com/repos/o/r",
            headers={"Authorization": "Bearer forbidden"},
        )


def test_empty_github_repository_allowlist_denied():
    with pytest.raises(ValueError, match="At least one GitHub repository"):
        github_policy(())


def test_shadow_service_has_no_write_proxy_surface():
    service = ShadowReadService(broker())
    assert not hasattr(service, "execute")
    assert not hasattr(service, "approve")
    assert not hasattr(service, "write_proxy")
