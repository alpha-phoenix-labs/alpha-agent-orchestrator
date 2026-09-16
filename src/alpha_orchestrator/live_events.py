from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


LIVE_EVENT_SCHEMA_VERSION = 1


class LiveEventDecision(str, Enum):
    ACCEPTED = "ACCEPTED"
    DUPLICATE = "DUPLICATE"
    RESYNC_REQUIRED = "RESYNC_REQUIRED"
    INVALID = "INVALID"


class LiveEventValidationError(ValueError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class LiveEventEnvelope:
    schema_version: int
    event_id: str
    sequence: int
    base_state_version: int
    state_version: int
    emitted_at: str
    event_type: str
    payload: Mapping[str, Any]


@dataclass(frozen=True)
class LiveEventCursor:
    """Client-side ordering baseline derived from an authoritative snapshot/resync."""

    last_sequence: int
    current_state_version: int
    seen_event_ids: frozenset[str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        if type(self.last_sequence) is not int or self.last_sequence < 0:
            raise ValueError("INVALID_CURSOR_SEQUENCE")
        if type(self.current_state_version) is not int or self.current_state_version < 0:
            raise ValueError("INVALID_CURSOR_STATE_VERSION")


@dataclass(frozen=True)
class LiveEventEvaluation:
    decision: LiveEventDecision
    reason: str
    cursor: LiveEventCursor
    event: LiveEventEnvelope | None = None


_EXPECTED_FIELDS = frozenset(
    {
        "schema_version",
        "event_id",
        "sequence",
        "base_state_version",
        "state_version",
        "emitted_at",
        "event_type",
        "payload",
    }
)


def _require_int(value: object, reason: str, *, minimum: int) -> int:
    if type(value) is not int or value < minimum:
        raise LiveEventValidationError(reason)
    return value


def _require_non_empty_string(value: object, reason: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LiveEventValidationError(reason)
    return value


def _require_timestamp(value: object) -> str:
    timestamp = _require_non_empty_string(value, "INVALID_EMITTED_AT")
    normalized = timestamp[:-1] + "+00:00" if timestamp.endswith("Z") else timestamp
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise LiveEventValidationError("INVALID_EMITTED_AT") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise LiveEventValidationError("INVALID_EMITTED_AT")
    return timestamp


def parse_live_event(value: object) -> LiveEventEnvelope:
    """Strictly parse the transport-neutral Phase 4.11 live-event envelope."""

    if not isinstance(value, Mapping):
        raise LiveEventValidationError("EVENT_MUST_BE_OBJECT")

    if frozenset(value.keys()) != _EXPECTED_FIELDS:
        raise LiveEventValidationError("INVALID_EVENT_FIELDS")

    schema_version = _require_int(value["schema_version"], "INVALID_SCHEMA_VERSION", minimum=1)
    if schema_version != LIVE_EVENT_SCHEMA_VERSION:
        raise LiveEventValidationError("UNSUPPORTED_SCHEMA_VERSION")

    event_id = _require_non_empty_string(value["event_id"], "INVALID_EVENT_ID")
    sequence = _require_int(value["sequence"], "INVALID_SEQUENCE", minimum=1)
    base_state_version = _require_int(
        value["base_state_version"], "INVALID_BASE_STATE_VERSION", minimum=0
    )
    state_version = _require_int(value["state_version"], "INVALID_STATE_VERSION", minimum=0)
    if state_version < base_state_version:
        raise LiveEventValidationError("STATE_VERSION_BEFORE_BASE")

    emitted_at = _require_timestamp(value["emitted_at"])
    event_type = _require_non_empty_string(value["event_type"], "INVALID_EVENT_TYPE")
    payload = value["payload"]
    if not isinstance(payload, Mapping):
        raise LiveEventValidationError("INVALID_PAYLOAD")

    return LiveEventEnvelope(
        schema_version=schema_version,
        event_id=event_id,
        sequence=sequence,
        base_state_version=base_state_version,
        state_version=state_version,
        emitted_at=emitted_at,
        event_type=event_type,
        payload=dict(payload),
    )


def evaluate_live_event(cursor: LiveEventCursor, value: object) -> LiveEventEvaluation:
    """Evaluate schema, identity, order and state-version continuity without applying payload."""

    try:
        event = parse_live_event(value)
    except LiveEventValidationError as exc:
        return LiveEventEvaluation(
            decision=LiveEventDecision.INVALID,
            reason=exc.reason,
            cursor=cursor,
        )

    if event.event_id in cursor.seen_event_ids:
        return LiveEventEvaluation(
            decision=LiveEventDecision.DUPLICATE,
            reason="DUPLICATE_EVENT_ID",
            cursor=cursor,
            event=event,
        )

    if event.sequence == cursor.last_sequence:
        return LiveEventEvaluation(
            decision=LiveEventDecision.RESYNC_REQUIRED,
            reason="SEQUENCE_COLLISION",
            cursor=cursor,
            event=event,
        )

    if event.sequence < cursor.last_sequence:
        return LiveEventEvaluation(
            decision=LiveEventDecision.RESYNC_REQUIRED,
            reason="STALE_OR_OUT_OF_ORDER_SEQUENCE",
            cursor=cursor,
            event=event,
        )

    expected_sequence = cursor.last_sequence + 1
    if event.sequence > expected_sequence:
        return LiveEventEvaluation(
            decision=LiveEventDecision.RESYNC_REQUIRED,
            reason="MISSING_SEQUENCE",
            cursor=cursor,
            event=event,
        )

    if event.base_state_version != cursor.current_state_version:
        return LiveEventEvaluation(
            decision=LiveEventDecision.RESYNC_REQUIRED,
            reason="STATE_VERSION_DRIFT",
            cursor=cursor,
            event=event,
        )

    next_cursor = LiveEventCursor(
        last_sequence=event.sequence,
        current_state_version=event.state_version,
        seen_event_ids=cursor.seen_event_ids | {event.event_id},
    )
    return LiveEventEvaluation(
        decision=LiveEventDecision.ACCEPTED,
        reason="ACCEPTED",
        cursor=next_cursor,
        event=event,
    )
