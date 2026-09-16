from __future__ import annotations

from dataclasses import dataclass
from .models import SystemMode, WorkOrder
from .locks import ResourceLockManager


@dataclass(frozen=True)
class GuardDecision:
    allowed: bool
    reason: str


class ControlGuards:
    def __init__(self, *, mode: SystemMode, writes_enabled: bool, locks: ResourceLockManager) -> None:
        self.mode = mode
        self.writes_enabled = writes_enabled
        self.locks = locks

    def pre_approval(self, order: WorkOrder, current_state_version: str) -> GuardDecision:
        if self.mode == SystemMode.EMERGENCY_FREEZE:
            return GuardDecision(False, "EMERGENCY_FREEZE")
        if not order.evidence_verified:
            return GuardDecision(False, "EVIDENCE_NOT_VERIFIED")
        if not order.independent_review_confirmed:
            return GuardDecision(False, "INDEPENDENT_REVIEW_MISSING")
        if order.base_state_version != current_state_version:
            return GuardDecision(False, "STALE_STATE")
        return GuardDecision(True, "ELIGIBLE_FOR_HUMAN_GATE")

    def pre_execute(self, order: WorkOrder, *, current_state_version: str,
                    lock_resource: str, lock_owner: str) -> GuardDecision:
        if self.mode in {SystemMode.OFFLINE, SystemMode.READ_ONLY, SystemMode.SHADOW,
                         SystemMode.EMERGENCY_FREEZE}:
            return GuardDecision(False, f"MODE_BLOCKS_WRITE:{self.mode.value}")
        if not self.writes_enabled:
            return GuardDecision(False, "WRITES_DISABLED")
        if order.base_state_version != current_state_version:
            return GuardDecision(False, "STALE_STATE")
        lock = self.locks.get(lock_resource)
        if not lock:
            return GuardDecision(False, "LOCK_MISSING")
        if lock.owner != lock_owner or lock.order_id != order.order_id:
            return GuardDecision(False, "LOCK_OWNERSHIP_MISMATCH")
        return GuardDecision(True, "EXECUTION_GATES_PASS")
