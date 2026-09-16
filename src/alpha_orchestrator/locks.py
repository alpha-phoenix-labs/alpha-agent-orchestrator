from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import threading


@dataclass(frozen=True)
class ResourceLock:
    resource: str
    owner: str
    order_id: str
    acquired_at: str


class ResourceLockManager:
    """Atomic in-process lock manager for mock/offline phases."""

    def __init__(self) -> None:
        self._mutex = threading.RLock()
        self._locks: dict[str, ResourceLock] = {}

    def acquire(self, resource: str, owner: str, order_id: str) -> ResourceLock | None:
        with self._mutex:
            if resource in self._locks:
                return None
            lock = ResourceLock(resource, owner, order_id, datetime.now(timezone.utc).isoformat())
            self._locks[resource] = lock
            return lock

    def get(self, resource: str) -> ResourceLock | None:
        with self._mutex:
            return self._locks.get(resource)

    def release(self, resource: str, owner: str, order_id: str) -> bool:
        with self._mutex:
            lock = self._locks.get(resource)
            if not lock or lock.owner != owner or lock.order_id != order_id:
                return False
            del self._locks[resource]
            return True
