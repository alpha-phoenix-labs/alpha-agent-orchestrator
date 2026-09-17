from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .live_events import (
    LIVE_EVENT_SCHEMA_VERSION,
    LiveEventCursor,
    LiveEventEnvelope,
    LiveEventValidationError,
    parse_live_event,
)


def _default_event_id() -> str:
    return str(uuid4())


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LiveEventProducer:
    """Create canonical live-event envelopes without selecting a network transport.

    The producer owns only envelope identity, sequence continuity and the transition
    from the current state version to the caller-supplied next state version. It
    does not interpret payloads, grant authority, expose a network endpoint or
    apply events to UI state.
    """

    def __init__(
        self,
        *,
        last_sequence: int,
        current_state_version: int,
        event_id_factory: Callable[[], str] | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        # Reuse the canonical cursor validation for the authoritative baseline.
        LiveEventCursor(
            last_sequence=last_sequence,
            current_state_version=current_state_version,
        )
        self._last_sequence = last_sequence
        self._current_state_version = current_state_version
        self._seen_event_ids: set[str] = set()
        self._event_id_factory = event_id_factory or _default_event_id
        self._clock = clock or _utc_now

    @property
    def cursor(self) -> LiveEventCursor:
        return LiveEventCursor(
            last_sequence=self._last_sequence,
            current_state_version=self._current_state_version,
            seen_event_ids=frozenset(self._seen_event_ids),
        )

    def emit(
        self,
        *,
        event_type: str,
        payload: Mapping[str, Any],
        state_version: int,
    ) -> LiveEventEnvelope:
        """Build one validated envelope and advance only after validation succeeds."""

        if type(state_version) is not int or state_version < self._current_state_version:
            raise LiveEventValidationError("STATE_VERSION_REGRESSION")

        event_id = self._event_id_factory()
        if event_id in self._seen_event_ids:
            raise LiveEventValidationError("DUPLICATE_EVENT_ID")

        emitted_at = self._clock()
        if emitted_at.tzinfo is None or emitted_at.utcoffset() is None:
            raise LiveEventValidationError("PRODUCER_CLOCK_MUST_BE_TIMEZONE_AWARE")

        next_sequence = self._last_sequence + 1
        event = parse_live_event(
            {
                "schema_version": LIVE_EVENT_SCHEMA_VERSION,
                "event_id": event_id,
                "sequence": next_sequence,
                "base_state_version": self._current_state_version,
                "state_version": state_version,
                "emitted_at": emitted_at.isoformat(),
                "event_type": event_type,
                "payload": payload,
            }
        )

        self._last_sequence = next_sequence
        self._current_state_version = state_version
        self._seen_event_ids.add(event.event_id)
        return event
