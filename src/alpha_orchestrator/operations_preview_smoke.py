from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Callable, Mapping
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PREVIEW_URL_ENV = "ALPHA_OPERATIONS_PREVIEW_URL"
PREVIEW_TOKEN_ENV = "ALPHA_OPERATIONS_PREVIEW_TOKEN"
DEFAULT_TIMEOUT_SECONDS = 20
SYSTEM_STATE_EVENT_TYPE = "VIEW_CONTRACT_SYSTEM_STATE"


class OperationsPreviewSmokeError(RuntimeError):
    """Fail-closed external preview verification error with secret-safe messages."""


@dataclass(frozen=True)
class _HttpResult:
    status: int
    headers: Mapping[str, str]
    body: bytes


UrlOpen = Callable[..., object]


def _request(
    *,
    base_url: str,
    path: str,
    method: str = "GET",
    token: str | None = None,
    opener: UrlOpen = urlopen,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> _HttpResult:
    headers = {"Accept": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(base_url.rstrip("/") + path, method=method, headers=headers)
    try:
        response = opener(request, timeout=timeout)
        with response:
            return _HttpResult(
                status=int(response.status),
                headers=dict(response.headers.items()),
                body=response.read(),
            )
    except HTTPError as exc:
        with exc:
            return _HttpResult(
                status=int(exc.code),
                headers=dict(exc.headers.items()),
                body=exc.read(),
            )
    except Exception as exc:
        raise OperationsPreviewSmokeError(f"HTTP_REQUEST_FAILED:{path}") from exc


def _json_body(result: _HttpResult, *, reason: str) -> object:
    try:
        return json.loads(result.body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise OperationsPreviewSmokeError(reason) from exc


def _require(condition: bool, reason: str) -> None:
    if not condition:
        raise OperationsPreviewSmokeError(reason)


def _system_state(snapshot: Mapping[str, object]) -> Mapping[str, object]:
    contracts = snapshot.get("contracts")
    _require(isinstance(contracts, list), "SNAPSHOT_CONTRACTS_INVALID")
    matches = [
        item
        for item in contracts
        if isinstance(item, Mapping) and item.get("contract") == "SYSTEM_STATE"
    ]
    _require(len(matches) == 1, "SNAPSHOT_SYSTEM_STATE_COUNT_INVALID")
    fields = matches[0].get("fields")
    _require(isinstance(fields, Mapping), "SNAPSHOT_SYSTEM_STATE_FIELDS_INVALID")
    return fields


def _validate_snapshot(payload: object) -> Mapping[str, object]:
    _require(isinstance(payload, Mapping), "SNAPSHOT_NOT_OBJECT")
    snapshot = payload
    _require(snapshot.get("schema_version") == 1, "SNAPSHOT_SCHEMA_VERSION_INVALID")
    sequence = snapshot.get("event_sequence")
    _require(type(sequence) is int and sequence >= 0, "SNAPSHOT_EVENT_SEQUENCE_INVALID")
    state_version = snapshot.get("state_version")
    _require(
        isinstance(state_version, str) and bool(state_version.strip()),
        "SNAPSHOT_STATE_VERSION_INVALID",
    )

    fields = _system_state(snapshot)
    mode = fields.get("mode")
    writes_enabled = fields.get("writes_enabled")
    state = fields.get("state_version")
    for name, field in (
        ("mode", mode),
        ("writes_enabled", writes_enabled),
        ("state_version", state),
    ):
        _require(isinstance(field, Mapping), f"SYSTEM_STATE_FIELD_INVALID:{name}")
        _require(field.get("source_class") == "AUTHORITATIVE", f"SYSTEM_STATE_SOURCE_INVALID:{name}")
        _require(field.get("available") is True, f"SYSTEM_STATE_UNAVAILABLE:{name}")
    _require(mode.get("value") == "SHADOW", "SYSTEM_MODE_NOT_SHADOW")
    _require(writes_enabled.get("value") is False, "WRITES_NOT_DISABLED")
    _require(state.get("value") == state_version, "SYSTEM_STATE_VERSION_MISMATCH")
    return snapshot


def _parse_single_sse_event(body: bytes) -> Mapping[str, object] | None:
    if not body:
        return None
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise OperationsPreviewSmokeError("SSE_NOT_UTF8") from exc
    records = [record for record in text.split("\n\n") if record.strip()]
    _require(len(records) == 1, "SSE_RECORD_COUNT_INVALID")
    data_lines = [line[6:] for line in records[0].splitlines() if line.startswith("data: ")]
    _require(len(data_lines) == 1, "SSE_DATA_LINE_INVALID")
    try:
        payload = json.loads(data_lines[0])
    except json.JSONDecodeError as exc:
        raise OperationsPreviewSmokeError("SSE_DATA_JSON_INVALID") from exc
    _require(isinstance(payload, Mapping), "SSE_EVENT_NOT_OBJECT")
    return payload


def run_external_preview_smoke(
    *,
    base_url: str,
    token: str,
    opener: UrlOpen = urlopen,
) -> dict[str, object]:
    if not isinstance(base_url, str) or not base_url.startswith("https://"):
        raise OperationsPreviewSmokeError("PREVIEW_URL_MUST_BE_HTTPS")
    if not isinstance(token, str) or not token or "\r" in token or "\n" in token:
        raise OperationsPreviewSmokeError("PREVIEW_TOKEN_INVALID")

    health = _request(base_url=base_url, path="/healthz", opener=opener)
    _require(health.status == 200, "HEALTH_STATUS_INVALID")
    _require(
        _json_body(health, reason="HEALTH_JSON_INVALID")
        == {"ok": True, "mode": "OPERATIONS_PREVIEW", "writes_enabled": False},
        "HEALTH_PAYLOAD_INVALID",
    )

    unauthorized = _request(
        base_url=base_url,
        path="/v1/operations/snapshot",
        opener=opener,
    )
    _require(unauthorized.status == 401, "UNAUTHORIZED_SNAPSHOT_NOT_401")
    _require(unauthorized.body == b"", "UNAUTHORIZED_SNAPSHOT_BODY_NOT_EMPTY")

    before_result = _request(
        base_url=base_url,
        path="/v1/operations/snapshot",
        token=token,
        opener=opener,
    )
    _require(before_result.status == 200, "AUTHORIZED_SNAPSHOT_STATUS_INVALID")
    before = _validate_snapshot(
        _json_body(before_result, reason="AUTHORIZED_SNAPSHOT_JSON_INVALID")
    )
    before_sequence = int(before["event_sequence"])
    before_state = str(before["state_version"])

    events_result = _request(
        base_url=base_url,
        path="/v1/operations/events",
        token=token,
        opener=opener,
    )
    _require(events_result.status == 200, "SSE_STATUS_INVALID")
    content_type = events_result.headers.get("Content-Type", "")
    _require(content_type.startswith("text/event-stream"), "SSE_CONTENT_TYPE_INVALID")
    event = _parse_single_sse_event(events_result.body)

    after_result = _request(
        base_url=base_url,
        path="/v1/operations/snapshot",
        token=token,
        opener=opener,
    )
    _require(after_result.status == 200, "POST_EVENT_SNAPSHOT_STATUS_INVALID")
    after = _validate_snapshot(
        _json_body(after_result, reason="POST_EVENT_SNAPSHOT_JSON_INVALID")
    )

    if event is None:
        _require(before_sequence >= 1, "SSE_EVENT_MISSING_BEFORE_FIRST_EMISSION")
        _require(after["event_sequence"] == before_sequence, "EMPTY_SSE_SEQUENCE_CHANGED")
        _require(after["state_version"] == before_state, "EMPTY_SSE_STATE_CHANGED")
        event_result = "ALREADY_EMITTED"
    else:
        _require(event.get("schema_version") == 1, "SSE_SCHEMA_VERSION_INVALID")
        _require(event.get("event_type") == SYSTEM_STATE_EVENT_TYPE, "SSE_EVENT_TYPE_INVALID")
        _require(event.get("sequence") == before_sequence + 1, "SSE_SEQUENCE_INVALID")
        _require(event.get("base_state_version") == before_state, "SSE_BASE_STATE_INVALID")
        event_state = event.get("state_version")
        _require(isinstance(event_state, str) and bool(event_state.strip()), "SSE_STATE_INVALID")
        payload = event.get("payload")
        _require(isinstance(payload, Mapping), "SSE_PAYLOAD_INVALID")
        _require(payload.get("contract") == "SYSTEM_STATE", "SSE_CONTRACT_INVALID")
        _require(payload.get("source_class") == "AUTHORITATIVE", "SSE_SOURCE_INVALID")
        _require(payload.get("mode") == "SHADOW", "SSE_MODE_NOT_SHADOW")
        _require(payload.get("writes_enabled") is False, "SSE_WRITES_NOT_DISABLED")
        _require(payload.get("state_version") == event_state, "SSE_PAYLOAD_STATE_MISMATCH")
        _require(after["event_sequence"] == event["sequence"], "POST_EVENT_SEQUENCE_MISMATCH")
        _require(after["state_version"] == event_state, "POST_EVENT_STATE_MISMATCH")
        event_result = "OBSERVED"

    mutation = _request(
        base_url=base_url,
        path="/v1/operations/snapshot",
        method="POST",
        token=token,
        opener=opener,
    )
    _require(mutation.status == 405, "MUTATION_METHOD_NOT_BLOCKED")
    _require(mutation.headers.get("Allow") == "GET", "MUTATION_ALLOW_HEADER_INVALID")

    return {
        "health": "PASS",
        "unauthorized_snapshot": "PASS",
        "authorized_snapshot": "PASS",
        "sse": event_result,
        "mutation_block": "PASS",
        "mode": "SHADOW",
        "writes_enabled": False,
        "event_sequence": int(after["event_sequence"]),
    }


def main() -> int:
    base_url = os.environ.get(PREVIEW_URL_ENV, "")
    token = os.environ.get(PREVIEW_TOKEN_ENV, "")
    if not base_url:
        raise SystemExit(f"{PREVIEW_URL_ENV} is required")
    if not token:
        raise SystemExit(f"{PREVIEW_TOKEN_ENV} is required")
    try:
        result = run_external_preview_smoke(base_url=base_url, token=token)
    except OperationsPreviewSmokeError as exc:
        raise SystemExit(f"OPERATIONS_PREVIEW_SMOKE_FAILED:{exc}") from exc
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
