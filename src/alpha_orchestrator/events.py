from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any


@dataclass(frozen=True)
class AuditEvent:
    seq: int
    event_type: str
    payload: dict[str, Any]
    created_at: str
    prev_hash: str
    event_hash: str


class AuditLog:
    """Append-only, hash-chained in-memory audit log for the Phase-1 scaffold."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    def append(self, event_type: str, payload: dict[str, Any]) -> AuditEvent:
        prev_hash = self._events[-1].event_hash if self._events else "GENESIS"
        seq = len(self._events) + 1
        created_at = datetime.now(timezone.utc).isoformat()
        body = {
            "seq": seq,
            "event_type": event_type,
            "payload": payload,
            "created_at": created_at,
            "prev_hash": prev_hash,
        }
        raw = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
        event_hash = sha256(raw.encode("utf-8")).hexdigest()
        event = AuditEvent(seq, event_type, payload, created_at, prev_hash, event_hash)
        self._events.append(event)
        return event

    @property
    def events(self) -> tuple[AuditEvent, ...]:
        return tuple(self._events)

    def verify_chain(self) -> bool:
        prev = "GENESIS"
        for event in self._events:
            body = {
                "seq": event.seq,
                "event_type": event.event_type,
                "payload": event.payload,
                "created_at": event.created_at,
                "prev_hash": event.prev_hash,
            }
            raw = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
            if event.prev_hash != prev:
                return False
            if sha256(raw.encode("utf-8")).hexdigest() != event.event_hash:
                return False
            prev = event.event_hash
        return True
