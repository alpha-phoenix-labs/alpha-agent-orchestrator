from __future__ import annotations

from .approvals import ApprovalAuthority
from .events import AuditLog
from .guards import ControlGuards
from .locks import ResourceLockManager
from .models import OrderStatus, SystemMode, WorkOrder
from .state import StateStore
from .write_proxy import WriteProxy


class OrchestratorCore:
    """Deterministic control-plane core. No live integrations in v0.1."""

    def __init__(self, mode: SystemMode = SystemMode.OFFLINE, writes_enabled: bool = False,
                 max_executions_per_order: int = 1) -> None:
        self.mode = mode
        self.writes_enabled = writes_enabled
        self.state = StateStore({"system_mode": mode.value, "writes_enabled": writes_enabled})
        self.locks = ResourceLockManager()
        self.audit = AuditLog()
        self.approvals = ApprovalAuthority(required_approver="USER_ONLY")
        self.guards = ControlGuards(mode=mode, writes_enabled=writes_enabled, locks=self.locks)
        self.proxy = WriteProxy(
            mode_provider=lambda: self.mode,
            writes_enabled_provider=lambda: self.writes_enabled,
            state=self.state,
            locks=self.locks,
            max_executions_per_order=max_executions_per_order,
        )

    def _refresh_guards(self) -> None:
        self.guards = ControlGuards(mode=self.mode, writes_enabled=self.writes_enabled, locks=self.locks)

    def set_mode(self, mode: SystemMode, *, writes_enabled: bool) -> None:
        self.mode = mode
        self.writes_enabled = writes_enabled
        self.state.update({"system_mode": mode.value, "writes_enabled": writes_enabled})
        self._refresh_guards()
        self.audit.append("SYSTEM_MODE_CHANGED", {"mode": mode.value, "writes_enabled": writes_enabled})

    def emergency_freeze(self, reason: str) -> None:
        self.set_mode(SystemMode.EMERGENCY_FREEZE, writes_enabled=False)
        self.audit.append("EMERGENCY_FREEZE", {"reason": reason})

    def register_order(self, order: WorkOrder) -> None:
        self.audit.append("ORDER_CREATED", {"order_id": order.order_id, "plan_hash": order.plan_hash})

    def mark_verified(self, order: WorkOrder) -> None:
        order.evidence_verified = True
        order.independent_review_confirmed = True
        order.status = OrderStatus.VERIFIED
        self.audit.append("ORDER_VERIFIED", {"order_id": order.order_id})

    def eligible_for_human_gate(self, order: WorkOrder) -> bool:
        snapshot = self.state.snapshot()
        decision = self.guards.pre_approval(order, snapshot.version)
        self.audit.append("PRE_APPROVAL_GUARD", {
            "order_id": order.order_id,
            "allowed": decision.allowed,
            "reason": decision.reason,
        })
        if decision.allowed:
            order.status = OrderStatus.WAITING_FOR_APPROVAL
        return decision.allowed
