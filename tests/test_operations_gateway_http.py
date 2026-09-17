import json

from alpha_orchestrator.live_events import LiveEventCursor, parse_live_event
from alpha_orchestrator.live_sse import SSE_CONTENT_TYPE, encode_sse_event
from alpha_orchestrator.models import SystemMode
from alpha_orchestrator.operations_gateway_http import (
    DEVELOPMENT_OPERATOR_PRINCIPAL,
    OPERATIONS_EVENTS_PATH,
    OPERATIONS_SNAPSHOT_PATH,
    DevelopmentOperatorBearerAuthorizer,
    OperationsGatewayHttpAdapter,
    OperationsGatewayResponse,
    OperationsGatewayStreamResponse,
)
from alpha_orchestrator.operations_read import OperationsReadBoundary
from alpha_orchestrator.state import StateSnapshot
from alpha_orchestrator.view_contracts import system_state_view


def _system_state(version: str = "state-v1"):
    return system_state_view(
        mode=SystemMode.SHADOW,
        writes_enabled=False,
        snapshot=StateSnapshot(version=version, data={}),
    )


def _cursor(sequence: int = 7, version: str = "state-v1") -> LiveEventCursor:
    return LiveEventCursor(last_sequence=sequence, current_state_version=version)


def _event(sequence: int = 8, base: str = "state-v1", version: str = "state-v2"):
    return parse_live_event(
        {
            "schema_version": 1,
            "event_id": f"evt-{sequence}",
            "sequence": sequence,
            "base_state_version": base,
            "state_version": version,
            "emitted_at": "2026-09-17T20:30:00+00:00",
            "event_type": "VIEW_CONTRACT_SYSTEM_STATE",
            "payload": {
                "contract": "SYSTEM_STATE",
                "source_class": "AUTHORITATIVE",
                "mode": "SHADOW",
                "writes_enabled": False,
                "state_version": version,
            },
        }
    )


def _adapter(token: str = "preview-test-token") -> OperationsGatewayHttpAdapter:
    authorizer = DevelopmentOperatorBearerAuthorizer(expected_token=token)
    boundary = OperationsReadBoundary(authorizer=authorizer)
    return OperationsGatewayHttpAdapter(
        boundary=boundary,
        snapshot_provider=lambda: ((_system_state(),), _cursor()),
        event_provider=lambda: (_event(),),
    )


def _header(response, name: str) -> str | None:
    return dict(response.headers).get(name)


def test_development_operator_authorizer_is_redacted_and_fail_closed() -> None:
    authorizer = DevelopmentOperatorBearerAuthorizer(expected_token="preview-test-token")

    assert DEVELOPMENT_OPERATOR_PRINCIPAL == "DEVELOPMENT_OPERATOR"
    assert "preview-test-token" not in repr(authorizer)
    assert "<redacted>" in repr(authorizer)


def test_snapshot_and_sse_share_the_same_bearer_boundary() -> None:
    adapter = _adapter()
    authorization = "Bearer preview-test-token"

    snapshot = adapter.handle(
        method="GET",
        path=OPERATIONS_SNAPSHOT_PATH,
        authorization=authorization,
    )
    events = adapter.handle(
        method="GET",
        path=OPERATIONS_EVENTS_PATH,
        authorization=authorization,
    )

    assert isinstance(snapshot, OperationsGatewayResponse)
    assert snapshot.status == 200
    assert _header(snapshot, "Content-Type") == "application/json; charset=utf-8"
    assert _header(snapshot, "Cache-Control") == "no-store"
    payload = json.loads(snapshot.body)
    assert payload["state_version"] == "state-v1"
    assert payload["event_sequence"] == 7

    assert isinstance(events, OperationsGatewayStreamResponse)
    assert events.status == 200
    assert _header(events, "Content-Type") == SSE_CONTENT_TYPE
    assert tuple(events.body) == (encode_sse_event(_event()),)


def test_missing_or_malformed_bearer_returns_401_without_authority_payload() -> None:
    adapter = _adapter()

    for path in (OPERATIONS_SNAPSHOT_PATH, OPERATIONS_EVENTS_PATH):
        for authorization in (None, "", "Basic nope", "Bearer wrong"):
            response = adapter.handle(
                method="GET",
                path=path,
                authorization=authorization,
            )
            assert isinstance(response, OperationsGatewayResponse)
            assert response.status == 401
            assert response.body == b""


def test_empty_event_stream_is_authorized_before_200_response() -> None:
    boundary = OperationsReadBoundary(
        authorizer=DevelopmentOperatorBearerAuthorizer(expected_token="preview-test-token")
    )
    adapter = OperationsGatewayHttpAdapter(
        boundary=boundary,
        snapshot_provider=lambda: ((_system_state(),), _cursor()),
        event_provider=lambda: (),
    )

    denied = adapter.handle(
        method="GET",
        path=OPERATIONS_EVENTS_PATH,
        authorization=None,
    )
    allowed = adapter.handle(
        method="GET",
        path=OPERATIONS_EVENTS_PATH,
        authorization="Bearer preview-test-token",
    )

    assert isinstance(denied, OperationsGatewayResponse)
    assert denied.status == 401
    assert denied.body == b""
    assert isinstance(allowed, OperationsGatewayStreamResponse)
    assert allowed.status == 200
    assert tuple(allowed.body) == ()


def test_gateway_exposes_get_only_known_routes() -> None:
    adapter = _adapter()

    mutation = adapter.handle(
        method="POST",
        path=OPERATIONS_SNAPSHOT_PATH,
        authorization="Bearer preview-test-token",
    )
    missing = adapter.handle(
        method="GET",
        path="/v1/operations/unknown",
        authorization="Bearer preview-test-token",
    )

    assert isinstance(mutation, OperationsGatewayResponse)
    assert mutation.status == 405
    assert _header(mutation, "Allow") == "GET"
    assert mutation.body == b'{"error":"METHOD_NOT_ALLOWED"}'
    assert isinstance(missing, OperationsGatewayResponse)
    assert missing.status == 404


def test_snapshot_cursor_state_mismatch_is_sanitized_as_authority_unavailable() -> None:
    boundary = OperationsReadBoundary(
        authorizer=DevelopmentOperatorBearerAuthorizer(expected_token="preview-test-token")
    )
    adapter = OperationsGatewayHttpAdapter(
        boundary=boundary,
        snapshot_provider=lambda: ((_system_state(),), _cursor(version="state-other")),
        event_provider=lambda: (),
    )

    response = adapter.handle(
        method="GET",
        path=OPERATIONS_SNAPSHOT_PATH,
        authorization="Bearer preview-test-token",
    )

    assert isinstance(response, OperationsGatewayResponse)
    assert response.status == 503
    assert response.body == b'{"error":"AUTHORITY_UNAVAILABLE"}'
