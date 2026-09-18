import json

import pytest

from alpha_orchestrator.live_events import LiveEventCursor, parse_live_event
from alpha_orchestrator.live_sse import encode_sse_event
from alpha_orchestrator.models import SystemMode
from alpha_orchestrator.operations_read import (
    OPERATIONS_READ_SNAPSHOT_SCHEMA_VERSION,
    OperationsReadBoundary,
    OperationsReadSnapshot,
    OperationsReadSnapshotError,
    OperationsReadUnauthorized,
)
from alpha_orchestrator.state import StateSnapshot
from alpha_orchestrator.view_contracts import (
    ContractName,
    SourceClass,
    ViewContract,
    ViewField,
    runtime_view_unavailable,
    system_state_view,
)


class RecordingAuthorizer:
    def __init__(self, *, allowed_context: object) -> None:
        self.allowed_context = allowed_context
        self.calls: list[object | None] = []

    def authorize(self, auth_context: object | None) -> None:
        self.calls.append(auth_context)
        if auth_context != self.allowed_context:
            raise OperationsReadUnauthorized("TEST_DENIED")


class BrokenAuthorizer:
    def authorize(self, auth_context: object | None) -> None:
        raise RuntimeError("auth backend unavailable")


def _system_state(version: str = "state-v1") -> ViewContract:
    return system_state_view(
        mode=SystemMode.SHADOW,
        writes_enabled=False,
        snapshot=StateSnapshot(version=version, data={}),
    )


def _cursor(sequence: int = 7, version: str = "state-v1") -> LiveEventCursor:
    return LiveEventCursor(last_sequence=sequence, current_state_version=version)


def _event():
    return parse_live_event(
        {
            "schema_version": 1,
            "event_id": "evt-1",
            "sequence": 8,
            "base_state_version": "state-v1",
            "state_version": "state-v2",
            "emitted_at": "2026-09-17T19:30:00+00:00",
            "event_type": "VIEW_CONTRACT_SYSTEM_STATE",
            "payload": {
                "contract": "SYSTEM_STATE",
                "source_class": "AUTHORITATIVE",
                "mode": "SHADOW",
                "writes_enabled": False,
                "state_version": "state-v2",
            },
        }
    )


def test_snapshot_preserves_backend_authority_and_continuity_metadata() -> None:
    snapshot = OperationsReadSnapshot.from_contracts(
        (
            _system_state(),
            runtime_view_unavailable("NO_AUTHORITATIVE_RUNTIME_STATE"),
        ),
        live_cursor=_cursor(),
    )

    payload = json.loads(snapshot.encode_json())

    assert payload["schema_version"] == OPERATIONS_READ_SNAPSHOT_SCHEMA_VERSION == 1
    assert payload["state_version"] == "state-v1"
    assert payload["event_sequence"] == 7
    assert payload["contracts"][0]["contract"] == "SYSTEM_STATE"
    assert payload["contracts"][0]["fields"]["state_version"] == {
        "available": True,
        "reason": None,
        "source_class": "AUTHORITATIVE",
        "value": "state-v1",
    }
    assert payload["contracts"][1]["fields"]["state"] == {
        "available": False,
        "reason": "NO_AUTHORITATIVE_RUNTIME_STATE",
        "source_class": "RUNTIME",
        "value": None,
    }


def test_snapshot_requires_exactly_one_system_state() -> None:
    with pytest.raises(
        OperationsReadSnapshotError,
        match="OPERATIONS_SNAPSHOT_REQUIRES_ONE_SYSTEM_STATE",
    ):
        OperationsReadSnapshot.from_contracts(
            (runtime_view_unavailable("NO_RUNTIME"),),
            live_cursor=_cursor(),
        )

    with pytest.raises(
        OperationsReadSnapshotError,
        match="OPERATIONS_SNAPSHOT_REQUIRES_ONE_SYSTEM_STATE",
    ):
        OperationsReadSnapshot.from_contracts(
            (_system_state(), _system_state("state-v2")),
            live_cursor=_cursor(),
        )


def test_snapshot_rejects_unavailable_invalid_or_mismatched_state_version() -> None:
    unavailable = ViewContract(
        ContractName.SYSTEM_STATE,
        {
            "mode": ViewField.known(SourceClass.AUTHORITATIVE, "SHADOW"),
            "writes_enabled": ViewField.known(SourceClass.AUTHORITATIVE, False),
            "state_version": ViewField.unknown(
                SourceClass.AUTHORITATIVE,
                "NO_AUTHORITATIVE_STATE_VERSION",
            ),
        },
    )
    with pytest.raises(
        OperationsReadSnapshotError,
        match="OPERATIONS_SNAPSHOT_STATE_VERSION_UNAVAILABLE",
    ):
        OperationsReadSnapshot.from_contracts((unavailable,), live_cursor=_cursor())

    invalid = ViewContract(
        ContractName.SYSTEM_STATE,
        {
            "mode": ViewField.known(SourceClass.AUTHORITATIVE, "SHADOW"),
            "writes_enabled": ViewField.known(SourceClass.AUTHORITATIVE, False),
            "state_version": ViewField.known(SourceClass.AUTHORITATIVE, ""),
        },
    )
    with pytest.raises(
        OperationsReadSnapshotError,
        match="OPERATIONS_SNAPSHOT_INVALID_STATE_VERSION",
    ):
        OperationsReadSnapshot.from_contracts((invalid,), live_cursor=_cursor())

    with pytest.raises(
        OperationsReadSnapshotError,
        match="OPERATIONS_SNAPSHOT_LIVE_CURSOR_STATE_MISMATCH",
    ):
        OperationsReadSnapshot.from_contracts(
            (_system_state(),),
            live_cursor=_cursor(version="state-other"),
        )


def test_snapshot_sse_event_and_stream_use_same_authorizer() -> None:
    context = object()
    authorizer = RecordingAuthorizer(allowed_context=context)
    boundary = OperationsReadBoundary(authorizer=authorizer)

    snapshot_body = boundary.snapshot(
        auth_context=context,
        contracts=(_system_state(),),
        live_cursor=_cursor(),
    )
    event_body = boundary.sse_event(auth_context=context, event=_event())
    stream = boundary.sse_stream(auth_context=context, events=(_event(),))

    assert json.loads(snapshot_body)["state_version"] == "state-v1"
    assert json.loads(snapshot_body)["event_sequence"] == 7
    assert event_body == encode_sse_event(_event())
    assert tuple(stream) == (encode_sse_event(_event()),)
    assert authorizer.calls == [context, context, context]


def test_read_boundary_fails_closed_without_or_on_failed_authorization() -> None:
    with pytest.raises(
        OperationsReadUnauthorized,
        match="OPERATIONS_READ_AUTHORIZER_REQUIRED",
    ):
        OperationsReadBoundary(authorizer=None)

    context = object()
    authorizer = RecordingAuthorizer(allowed_context=context)
    boundary = OperationsReadBoundary(authorizer=authorizer)

    with pytest.raises(OperationsReadUnauthorized, match="TEST_DENIED"):
        boundary.snapshot(
            auth_context=object(),
            contracts=(_system_state(),),
            live_cursor=_cursor(),
        )
    with pytest.raises(OperationsReadUnauthorized, match="TEST_DENIED"):
        boundary.sse_event(auth_context=object(), event=_event())
    with pytest.raises(OperationsReadUnauthorized, match="TEST_DENIED"):
        boundary.sse_stream(auth_context=object(), events=())

    broken = OperationsReadBoundary(authorizer=BrokenAuthorizer())
    with pytest.raises(
        OperationsReadUnauthorized,
        match="OPERATIONS_READ_AUTHORIZATION_FAILED",
    ):
        broken.snapshot(
            auth_context=context,
            contracts=(_system_state(),),
            live_cursor=_cursor(),
        )
