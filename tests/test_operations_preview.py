from __future__ import annotations

import json

from alpha_orchestrator.operations_preview import build_operations_preview_adapter


def _authorization(token: str) -> str:
    return f"Bearer {token}"


def _event_payload(chunk: bytes) -> dict[str, object]:
    lines = chunk.decode("utf-8").strip().splitlines()
    assert len(lines) == 3
    assert lines[0].startswith("id: ")
    assert lines[1] == "event: VIEW_CONTRACT_SYSTEM_STATE"
    assert lines[2].startswith("data: ")
    return json.loads(lines[2][len("data: ") :])


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


def test_preview_events_emit_real_authoritative_system_state_once() -> None:
    token = "preview-test-token"
    adapter = build_operations_preview_adapter(token=token)

    baseline = adapter.handle(
        method="GET",
        path="/v1/operations/snapshot",
        authorization=_authorization(token),
    )
    baseline_payload = json.loads(baseline.body)
    assert baseline_payload["event_sequence"] == 0

    unauthorized = adapter.handle(
        method="GET",
        path="/v1/operations/events",
        authorization=None,
    )
    assert unauthorized.status == 401
    assert unauthorized.body == b""

    response = adapter.handle(
        method="GET",
        path="/v1/operations/events",
        authorization=_authorization(token),
    )
    assert response.status == 200
    chunks = tuple(response.body)
    assert len(chunks) == 1

    event = _event_payload(chunks[0])
    assert event["sequence"] == 1
    assert event["base_state_version"] == baseline_payload["state_version"]
    assert event["state_version"] == baseline_payload["state_version"]
    assert event["event_type"] == "VIEW_CONTRACT_SYSTEM_STATE"
    assert event["payload"] == {
        "contract": "SYSTEM_STATE",
        "source_class": "AUTHORITATIVE",
        "mode": "SHADOW",
        "writes_enabled": False,
        "state_version": baseline_payload["state_version"],
    }

    refreshed = adapter.handle(
        method="GET",
        path="/v1/operations/snapshot",
        authorization=_authorization(token),
    )
    refreshed_payload = json.loads(refreshed.body)
    assert refreshed_payload["event_sequence"] == 1
    assert refreshed_payload["state_version"] == baseline_payload["state_version"]

    second_stream = adapter.handle(
        method="GET",
        path="/v1/operations/events",
        authorization=_authorization(token),
    )
    assert second_stream.status == 200
    assert tuple(second_stream.body) == ()
