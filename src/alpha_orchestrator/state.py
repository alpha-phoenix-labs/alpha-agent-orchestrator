from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import threading
from typing import Any


@dataclass(frozen=True)
class StateSnapshot:
    version: str
    data: dict[str, Any]


class StateStore:
    """Thread-safe Phase-1 state store. Replace with transactional DB in later phases."""

    def __init__(self, initial: dict[str, Any] | None = None) -> None:
        self._lock = threading.RLock()
        self._data = dict(initial or {})

    def _version(self) -> str:
        raw = json.dumps(self._data, sort_keys=True, separators=(",", ":"), default=str)
        return sha256(raw.encode("utf-8")).hexdigest()

    def snapshot(self) -> StateSnapshot:
        with self._lock:
            return StateSnapshot(self._version(), dict(self._data))

    def update(self, patch: dict[str, Any]) -> StateSnapshot:
        with self._lock:
            self._data.update(patch)
            return self.snapshot()
