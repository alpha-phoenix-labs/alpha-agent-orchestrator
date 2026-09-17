from __future__ import annotations

import json

from .live_events import LiveEventEnvelope, LiveEventValidationError


SSE_CONTENT_TYPE = "text/event-stream; charset=utf-8"


def _reject_line_breaks(value: str, reason: str) -> None:
    if "\r" in value or "\n" in value:
        raise LiveEventValidationError(reason)


def encode_sse_event(event: LiveEventEnvelope) -> bytes:
    """Encode one validated live-event envelope as one SSE record.

    This selects SSE framing only. It does not expose an endpoint, choose an
    authentication mechanism, define heartbeat cadence, add replay persistence,
    or grant UI authority.
    """

    _reject_line_breaks(event.event_id, "INVALID_SSE_EVENT_ID")
    _reject_line_breaks(event.event_type, "INVALID_SSE_EVENT_TYPE")

    data = json.dumps(
        {
            "schema_version": event.schema_version,
            "event_id": event.event_id,
            "sequence": event.sequence,
            "base_state_version": event.base_state_version,
            "state_version": event.state_version,
            "emitted_at": event.emitted_at,
            "event_type": event.event_type,
            "payload": dict(event.payload),
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    return (
        f"id: {event.event_id}\n"
        f"event: {event.event_type}\n"
        f"data: {data}\n\n"
    ).encode("utf-8")
