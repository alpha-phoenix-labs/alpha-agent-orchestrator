import pytest

from alpha_orchestrator.live_events import (
    LIVE_EVENT_SCHEMA_VERSION,
    LiveEventCursor,
    LiveEventDecision,
    LiveEventValidationError,
    evaluate_live_event,
    parse_live_event,
)


def event_payload(**overrides):
    payload = {
        "schema_version": LIVE_EVENT_SCHEMA_VERSION,
        "event_id": "evt-1",
        "sequence": 11,
        "base_state_version": 7,
        "state_version": 8,
        "emitted_at": "2026-09-17T00:30:00+00:00",
        "event_type": "WORK_ORDER_UPDATED",
        "payload": {"contract": "WORK_ORDER"},
    }
    payload.update(overrides)
    return payload


def cursor() -> LiveEventCursor:
    return LiveEventCursor(last_sequence=10, current_state_version=7)


def test_parse_live_event_accepts_transport_neutral_envelope():
    parsed = parse_live_event(event_payload())

    assert parsed.event_id == "evt-1"
    assert parsed.sequence == 11
    assert parsed.base_state_version == 7
    assert parsed.state_version == 8
    assert parsed.event_type == "WORK_ORDER_UPDATED"
    assert parsed.payload == {"contract": "WORK_ORDER"}


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"schema_version": 2}, "UNSUPPORTED_SCHEMA_VERSION"),
        ({"event_id": ""}, "INVALID_EVENT_ID"),
        ({"sequence": True}, "INVALID_SEQUENCE"),
        ({"sequence": 0}, "INVALID_SEQUENCE"),
        ({"base_state_version": -1}, "INVALID_BASE_STATE_VERSION"),
        ({"state_version": -1}, "INVALID_STATE_VERSION"),
        ({"base_state_version": 9, "state_version": 8}, "STATE_VERSION_BEFORE_BASE"),
        ({"emitted_at": "2026-09-17T00:30:00"}, "INVALID_EMITTED_AT"),
        ({"event_type": "  "}, "INVALID_EVENT_TYPE"),
        ({"payload": []}, "INVALID_PAYLOAD"),
    ],
)
def test_parse_live_event_rejects_schema_incompatible_values(changes, reason):
    with pytest.raises(LiveEventValidationError, match=reason):
        parse_live_event(event_payload(**changes))


def test_parse_live_event_rejects_missing_or_extra_fields():
    missing = event_payload()
    missing.pop("event_type")
    extra = event_payload(extra_field="nope")

    with pytest.raises(LiveEventValidationError, match="INVALID_EVENT_FIELDS"):
        parse_live_event(missing)
    with pytest.raises(LiveEventValidationError, match="INVALID_EVENT_FIELDS"):
        parse_live_event(extra)


def test_evaluate_live_event_accepts_only_contiguous_matching_state():
    result = evaluate_live_event(cursor(), event_payload())

    assert result.decision is LiveEventDecision.ACCEPTED
    assert result.reason == "ACCEPTED"
    assert result.cursor.last_sequence == 11
    assert result.cursor.current_state_version == 8
    assert result.cursor.seen_event_ids == frozenset({"evt-1"})


def test_duplicate_event_id_is_ignored_without_cursor_mutation():
    baseline = LiveEventCursor(
        last_sequence=11,
        current_state_version=8,
        seen_event_ids=frozenset({"evt-1"}),
    )
    result = evaluate_live_event(
        baseline,
        event_payload(sequence=12, base_state_version=8, state_version=9),
    )

    assert result.decision is LiveEventDecision.DUPLICATE
    assert result.reason == "DUPLICATE_EVENT_ID"
    assert result.cursor is baseline


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"event_id": "evt-collision", "sequence": 10}, "SEQUENCE_COLLISION"),
        ({"event_id": "evt-old", "sequence": 9}, "STALE_OR_OUT_OF_ORDER_SEQUENCE"),
        ({"event_id": "evt-gap", "sequence": 12}, "MISSING_SEQUENCE"),
        (
            {"event_id": "evt-drift", "sequence": 11, "base_state_version": 6, "state_version": 8},
            "STATE_VERSION_DRIFT",
        ),
    ],
)
def test_order_or_state_drift_requires_resync_without_cursor_mutation(changes, reason):
    baseline = cursor()
    result = evaluate_live_event(baseline, event_payload(**changes))

    assert result.decision is LiveEventDecision.RESYNC_REQUIRED
    assert result.reason == reason
    assert result.cursor is baseline


def test_malformed_event_is_invalid_and_cannot_advance_cursor():
    baseline = cursor()
    result = evaluate_live_event(baseline, {"schema_version": 1})

    assert result.decision is LiveEventDecision.INVALID
    assert result.reason == "INVALID_EVENT_FIELDS"
    assert result.cursor is baseline
    assert result.event is None


@pytest.mark.parametrize(
    "kwargs",
    [
        {"last_sequence": -1, "current_state_version": 0},
        {"last_sequence": 0, "current_state_version": -1},
        {"last_sequence": True, "current_state_version": 0},
    ],
)
def test_cursor_requires_authoritative_non_negative_integer_baseline(kwargs):
    with pytest.raises(ValueError):
        LiveEventCursor(**kwargs)
