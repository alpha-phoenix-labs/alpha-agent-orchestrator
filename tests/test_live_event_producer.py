from datetime import datetime, timezone

import pytest

from alpha_orchestrator.live_event_producer import LiveEventProducer
from alpha_orchestrator.live_events import LiveEventValidationError


def test_producer_emits_monotonic_envelopes_from_authoritative_baseline() -> None:
    ids = iter(["evt-11", "evt-12"])
    producer = LiveEventProducer(
        last_sequence=10,
        current_state_version=4,
        event_id_factory=lambda: next(ids),
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    first = producer.emit(event_type="runtime.observed", payload={"safe": True}, state_version=5)
    second = producer.emit(event_type="telemetry.observed", payload={"value": 1}, state_version=5)

    assert first.sequence == 11
    assert first.base_state_version == 4
    assert first.state_version == 5
    assert first.event_id == "evt-11"
    assert first.emitted_at.endswith("+00:00")

    assert second.sequence == 12
    assert second.base_state_version == 5
    assert second.state_version == 5
    assert producer.cursor.last_sequence == 12
    assert producer.cursor.current_state_version == 5
    assert producer.cursor.seen_event_ids == frozenset({"evt-11", "evt-12"})


def test_producer_rejects_state_version_regression_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=3,
        current_state_version=7,
        event_id_factory=lambda: "evt-regression",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    with pytest.raises(LiveEventValidationError, match="STATE_VERSION_REGRESSION"):
        producer.emit(event_type="runtime.observed", payload={}, state_version=6)

    assert producer.cursor.last_sequence == 3
    assert producer.cursor.current_state_version == 7
    assert producer.cursor.seen_event_ids == frozenset()


def test_producer_rejects_duplicate_event_identity_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=0,
        current_state_version=0,
        event_id_factory=lambda: "evt-duplicate",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    producer.emit(event_type="runtime.observed", payload={}, state_version=0)

    with pytest.raises(LiveEventValidationError, match="DUPLICATE_EVENT_ID"):
        producer.emit(event_type="runtime.observed", payload={}, state_version=0)

    assert producer.cursor.last_sequence == 1
    assert producer.cursor.seen_event_ids == frozenset({"evt-duplicate"})


def test_producer_rejects_naive_clock_without_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=2,
        current_state_version=1,
        event_id_factory=lambda: "evt-time",
        clock=lambda: datetime(2026, 9, 17, 18, 0),
    )

    with pytest.raises(LiveEventValidationError, match="PRODUCER_CLOCK_MUST_BE_TIMEZONE_AWARE"):
        producer.emit(event_type="runtime.observed", payload={}, state_version=1)

    assert producer.cursor.last_sequence == 2
    assert producer.cursor.seen_event_ids == frozenset()


def test_producer_reuses_canonical_schema_validation_before_advancing() -> None:
    producer = LiveEventProducer(
        last_sequence=0,
        current_state_version=0,
        event_id_factory=lambda: "evt-invalid-type",
        clock=lambda: datetime(2026, 9, 17, 18, 0, tzinfo=timezone.utc),
    )

    with pytest.raises(LiveEventValidationError, match="INVALID_EVENT_TYPE"):
        producer.emit(event_type="", payload={}, state_version=0)

    assert producer.cursor.last_sequence == 0
    assert producer.cursor.seen_event_ids == frozenset()
