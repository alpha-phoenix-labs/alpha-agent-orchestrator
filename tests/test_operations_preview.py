from __future__ import annotations

import json

from alpha_orchestrator.operations_preview import build_operations_preview_adapter


def _authorization(token: str) -> str:
    return f"Bearer {token}"


def test_preview_snapshot_is_shadow_read_only_and_fail_closed() -> None:
    token = "preview-test-token"
    adapter = build_operations_preview_adapter(token=token)

    unauthorized = adapter.handle(
        method="GET",
        path="/v1/operations/snapshot",
        authorization=None,
    )
    assert unauthorized.status == 401
    assert unauthorized.body == b""

    response = adapter.handle(
        method="GET",
        path="/v1/operations/snapshot",
        authorization=_authorization(token),
    )
    assert response.status == 200

    payload = json.loads(response.body)
    assert payload["schema_version"] == 1
    assert payload["event_sequence"] == 0

    contracts = {item["contract"]: item for item in payload["contracts"]}
    system = contracts["SYSTEM_STATE"]["fields"]
    assert system["mode"]["value"] == "SHADOW"
    assert system["writes_enabled"]["value"] is False
    assert system["state_version"]["value"] == payload["state_version"]

    canonical = contracts["CANONICAL_STATE"]["fields"]
    assert canonical["repository"]["available"] is False
    assert canonical["repository"]["reason"] == "PREVIEW_CANONICAL_STATE_NOT_WIRED"


def test_preview_exposes_no_mutation_method() -> None:
    token = "preview-test-token"
    adapter = build_operations_preview_adapter(token=token)

    for method in ("POST", "PUT", "PATCH", "DELETE"):
        response = adapter.handle(
            method=method,
            path="/v1/operations/snapshot",
            authorization=_authorization(token),
        )
        assert response.status == 405
        assert ("Allow", "GET") in response.headers


def test_preview_events_route_is_authorized_and_empty_until_real_producer_is_wired() -> None:
    token = "preview-test-token"
    adapter = build_operations_preview_adapter(token=token)

    response = adapter.handle(
        method="GET",
        path="/v1/operations/events",
        authorization=_authorization(token),
    )
    assert response.status == 200
    assert tuple(response.body) == ()
