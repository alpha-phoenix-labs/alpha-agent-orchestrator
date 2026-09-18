import json

import pytest

from alpha_orchestrator.live_events import LiveEventValidationError, parse_live_event
from alpha_orchestrator.live_sse import SSE_CONTENT_TYPE, encode_sse_event


def event(*, event_id: str = "evt-1", event_type: str = "VIEW_CONTRACT_SYSTEM_STATE"):
    return parse_live_event(
        {
            "schema_version": 1,
            "event_id": event_id,
            "sequence": 1,
            "base_state_version": "state-a",
            "state_version": "state-b",
            "emitted_at": "2026-09-17T18:45:00+00:00",
            "event_type": event_type,
            "payload": {
                "contract": "SYSTEM_STATE",
                "source_class": "AUTHORITATIVE",
                "mode": "READ_ONLY",
                "writes_enabled": False,
                "state_version": "state-b",
            },
        }
    )


def test_sse_content_type_is_explicit() -> None:
    assert SSE_CONTENT_TYPE == "text/event-stream; charset=utf-8"


def test_encode_sse_event_preserves_canonical_envelope() -> None:
    encoded = encode_sse_event(event()).decode("utf-8")
    lines = encoded.splitlines()

    assert lines[0] == "id: evt-1"
    assert lines[1] == "event: VIEW_CONTRACT_SYSTEM_STATE"
    assert lines[2].startswith("data: ")

    payload = json.loads(lines[2][6:])
    assert payload["event_id"] == "evt-1"
    assert payload["sequence"] == 1
    assert payload["base_state_version"] == "state-a"
    assert payload["state_version"] == "state-b"
    assert payload["payload"]["contract"] == "SYSTEM_STATE"
    assert payload["payload"]["source_class"] == "AUTHORITATIVE"
    assert encoded.endswith("\n\n")


@pytest.mark.parametrize(
    ("event_id", "event_type", "reason"),
    [
        ("evt-1\nretry: 0", "VIEW_CONTRACT_SYSTEM_STATE", "INVALID_SSE_EVENT_ID"),
        ("evt-1", "VIEW_CONTRACT_SYSTEM_STATE\ndata: forged", "INVALID_SSE_EVENT_TYPE"),
    ],
)
def test_sse_framing_rejects_line_injection(event_id, event_type, reason) -> None:
    with pytest.raises(LiveEventValidationError, match=reason):
        encode_sse_event(event(event_id=event_id, event_type=event_type))
