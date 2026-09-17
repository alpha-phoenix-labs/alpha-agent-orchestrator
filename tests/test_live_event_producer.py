from datetime import datetime, timezone

import pytest

from alpha_orchestrator.live_event_payloads import SYSTEM_STATE_VIEW_EVENT_TYPE
from alpha_orchestrator.live_event_producer import LiveEventProducer
from alpha_orchestrator.live_events import LiveEventValidationError
from alpha_orchestrator.models import SystemMode
from alpha_orchestrator.state import StateSnapshot
from alpha_orchestrator.view_contracts import system_state_view


def test_producer_emits_monotonic_envelopes_from_authoritative_baseline() -> None:
    ids = iter(["evt-11", "evt-12"])
    producer = LiveEventProducer(
        last_sequence=10,
        current_state_version="state-v4",
        event_id_factory=lambda: next(ids),
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    first = producer.emit(
        event_type="runtime.observed",
        payload={"safe": True},
        state_version="state-v5",
    )
    second = producer.emit(
        event_type="telemetry.observed",
        payload={"value": 1},
        state_version="state-v5",
    )

    assert first.sequence == 11
    assert first.base_state_version == "state-v4"
    assert first.state_version == "state-v5"
    assert first.event_id == "evt-11"
    assert first.emitted_at.endswith("+00:00")

    assert second.sequence == 12
    assert second.base_state_version == "state-v5"
    assert second.state_version == "state-v5"
    assert producer.cursor.last_sequence == 12
    assert producer.cursor.current_state_version == "state-v5"
    assert producer.cursor.seen_event_ids == frozenset({"evt-11", "evt-12"})


def test_producer_rejects_invalid_state_version_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=3,
        current_state_version="state-v7",
        event_id_factory=lambda: "evt-invalid-state",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    with pytest.raises(LiveEventValidationError, match="INVALID_STATE_VERSION"):
        producer.emit(event_type="runtime.observed", payload={}, state_version="")

    assert producer.cursor.last_sequence == 3
    assert producer.cursor.current_state_version == "state-v7"
    assert producer.cursor.seen_event_ids == frozenset()


def test_producer_rejects_duplicate_event_identity_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=0,
        current_state_version="state-v0",
        event_id_factory=lambda: "evt-duplicate",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    producer.emit(event_type="runtime.observed", payload={}, state_version="state-v0")

    with pytest.raises(LiveEventValidationError, match="DUPLICATE_EVENT_ID"):
        producer.emit(event_type="runtime.observed", payload={}, state_version="state-v0")

    assert producer.cursor.last_sequence == 1
    assert producer.cursor.seen_event_ids == frozenset({"evt-duplicate"})


def test_producer_rejects_naive_clock_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=2,
        current_state_version="state-v1",
        event_id_factory=lambda: "evt-time",
        clock=lambda: datetime(2026, 9, 17, 18, 0),
    )

    with pytest.raises(LiveEventValidationError, match="PRODUCER_CLOCK_MUST_BE_TIMEZONE_AWARE"):
        producer.emit(event_type="runtime.observed", payload={}, state_version="state-v1")

    assert producer.cursor.last_sequence == 2
    assert producer.cursor.seen_event_ids == frozenset()


def test_producer_reuses_canonical_schema_validation_before_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=0,
        current_state_version="state-v0",
        event_id_factory=lambda: "evt-invalid-type",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    with pytest.raises(LiveEventValidationError, match="INVALID_EVENT_TYPE"):
        producer.emit(event_type="", payload={}, state_version="state-v0")

    assert producer.cursor.last_sequence == 0
    assert producer.cursor.seen_event_ids == frozenset()


def test_typed_system_state_event_mirrors_authoritative_view_contract() -> None:
    producer = LiveEventProducer(
        last_sequence=4,
        current_state_version="prior-hash",
        event_id_factory=lambda: "evt-system-state",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )
    contract = system_state_view(
        mode=SystemMode.SHADOW,
        writes_enabled=False,
        snapshot=StateSnapshot(version="canonical-hash", data={}),
    )

    event = producer.emit_system_state(contract)

    assert event.event_type == SYSTEM_STATE_VIEW_EVENT_TYPE
    assert event.base_state_version == "prior-hash"
    assert event.state_version == "canonical-hash"
    assert event.payload == {
        "contract": "SYSTEM_STATE",
        "source_class": "AUTHORITATIVE",
        "mode": "SHADOW",
        "writes_enabled": False,
        "state_version": "canonical-hash",
    }
    assert producer.cursor.current_state_version == "canonical-hash"
