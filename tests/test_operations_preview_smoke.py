from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Mapping

import pytest

from alpha_orchestrator.operations_preview_smoke import (
    OperationsPreviewSmokeError,
    run_external_preview_smoke,
)


@dataclass
class _Response:
    status: int
    body: bytes = b""
    headers: Mapping[str, str] | None = None

    def __post_init__(self) -> None:
        self.headers = dict(self.headers or {})

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def read(self) -> bytes:
        return self.body


def _snapshot(*, sequence: int, state_version: str = "state-v1") -> bytes:
    payload = {
        "schema_version": 1,
        "state_version": state_version,
        "event_sequence": sequence,
        "contracts": [
            {
                "contract": "SYSTEM_STATE",
                "fields": {
                    "mode": {
                        "source_class": "AUTHORITATIVE",
                        "available": True,
                        "value": "SHADOW",
                        "reason": None,
                    },
                    "writes_enabled": {
                        "source_class": "AUTHORITATIVE",
                        "available": True,
                        "value": False,
                        "reason": None,
                    },
                    "state_version": {
                        "source_class": "AUTHORITATIVE",
                        "available": True,
                        "value": state_version,
                        "reason": None,
                    },
                },
            }
        ],
    }
    return json.dumps(payload).encode()


def _sse_event(*, sequence: int, state_version: str = "state-v1") -> bytes:
    event = {
        "schema_version": 1,
        "event_id": "event-1",
        "sequence": sequence,
        "base_state_version": state_version,
        "state_version": state_version,
        "emitted_at": "2026-09-17T21:00:00+00:00",
        "event_type": "VIEW_CONTRACT_SYSTEM_STATE",
        "payload": {
            "contract": "SYSTEM_STATE",
            "source_class": "AUTHORITATIVE",
            "mode": "SHADOW",
            "writes_enabled": False,
            "state_version": state_version,
        },
    }
    return (
        "id: event-1\n"
        "event: VIEW_CONTRACT_SYSTEM_STATE\n"
        f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
    ).encode()


def test_external_smoke_observes_first_live_event_and_blocks_mutation() -> None:
    calls: list[tuple[str, str, bool]] = []
    snapshot_reads = 0

    def opener(request, *, timeout):
        nonlocal snapshot_reads
        assert timeout == 20
        path = request.full_url.removeprefix("https://preview.example")
        method = request.get_method()
        authorized = request.get_header("Authorization") == "Bearer secret-token"
        calls.append((method, path, authorized))

        if path == "/healthz":
            return _Response(
                200,
                b'{"ok":true,"mode":"OPERATIONS_PREVIEW","writes_enabled":false}',
                {"Content-Type": "application/json"},
            )
        if path == "/v1/operations/snapshot" and method == "POST":
            return _Response(405, b'{"error":"METHOD_NOT_ALLOWED"}', {"Allow": "GET"})
        if path == "/v1/operations/snapshot" and not authorized:
            return _Response(401)
        if path == "/v1/operations/snapshot":
            snapshot_reads += 1
            return _Response(200, _snapshot(sequence=0 if snapshot_reads == 1 else 1))
        if path == "/v1/operations/events":
            return _Response(
                200,
                _sse_event(sequence=1),
                {"Content-Type": "text/event-stream; charset=utf-8"},
            )
        raise AssertionError((method, path))

    result = run_external_preview_smoke(
        base_url="https://preview.example",
        token="secret-token",
        opener=opener,
    )

    assert result == {
        "health": "PASS",
        "unauthorized_snapshot": "PASS",
        "authorized_snapshot": "PASS",
        "sse": "OBSERVED",
        "mutation_block": "PASS",
        "mode": "SHADOW",
        "writes_enabled": False,
        "event_sequence": 1,
    }
    assert calls[-1] == ("POST", "/v1/operations/snapshot", True)


def test_external_smoke_is_repeatable_after_event_was_already_emitted() -> None:
    def opener(request, *, timeout):
        path = request.full_url.removeprefix("https://preview.example")
        method = request.get_method()
        authorized = request.get_header("Authorization") == "Bearer secret-token"
        if path == "/healthz":
            return _Response(
                200,
                b'{"ok":true,"mode":"OPERATIONS_PREVIEW","writes_enabled":false}',
            )
        if path == "/v1/operations/snapshot" and method == "POST":
            return _Response(405, headers={"Allow": "GET"})
        if path == "/v1/operations/snapshot" and not authorized:
            return _Response(401)
        if path == "/v1/operations/snapshot":
            return _Response(200, _snapshot(sequence=1))
        if path == "/v1/operations/events":
            return _Response(200, b"", {"Content-Type": "text/event-stream; charset=utf-8"})
        raise AssertionError((method, path))

    result = run_external_preview_smoke(
        base_url="https://preview.example",
        token="secret-token",
        opener=opener,
    )
    assert result["sse"] == "ALREADY_EMITTED"
    assert result["event_sequence"] == 1


def test_external_smoke_rejects_missing_first_event() -> None:
    def opener(request, *, timeout):
        path = request.full_url.removeprefix("https://preview.example")
        method = request.get_method()
        authorized = request.get_header("Authorization") == "Bearer secret-token"
        if path == "/healthz":
            return _Response(
                200,
                b'{"ok":true,"mode":"OPERATIONS_PREVIEW","writes_enabled":false}',
            )
        if path == "/v1/operations/snapshot" and method == "POST":
            return _Response(405, headers={"Allow": "GET"})
        if path == "/v1/operations/snapshot" and not authorized:
            return _Response(401)
        if path == "/v1/operations/snapshot":
            return _Response(200, _snapshot(sequence=0))
        if path == "/v1/operations/events":
            return _Response(200, b"", {"Content-Type": "text/event-stream; charset=utf-8"})
        raise AssertionError((method, path))

    with pytest.raises(OperationsPreviewSmokeError, match="SSE_EVENT_MISSING_BEFORE_FIRST_EMISSION"):
        run_external_preview_smoke(
            base_url="https://preview.example",
            token="secret-token",
            opener=opener,
        )


def test_external_smoke_errors_do_not_expose_token() -> None:
    def opener(request, *, timeout):
        raise OSError("network down")

    with pytest.raises(OperationsPreviewSmokeError) as exc_info:
        run_external_preview_smoke(
            base_url="https://preview.example",
            token="super-secret-value",
            opener=opener,
        )
    assert "super-secret-value" not in str(exc_info.value)


def test_external_smoke_requires_https() -> None:
    with pytest.raises(OperationsPreviewSmokeError, match="PREVIEW_URL_MUST_BE_HTTPS"):
        run_external_preview_smoke(
            base_url="http://preview.example",
            token="secret-token",
        )
