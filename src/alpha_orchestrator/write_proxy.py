from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import threading
from typing import Callable, Any

from .actions import CODE_ACTIONS, INFRA_ACTIONS
from .approvals import Capability
from .locks import ResourceLockManager
from .models import SystemMode, WorkOrder
from .state import StateStore


@dataclass(frozen=True)
class ExecutionResult:
    execution_id: str
    success: bool
    detail: str
    output: dict[str, Any]


class WriteProxy:
    """Deterministic final write choke point for explicitly registered executors.

    Security invariants are revalidated immediately before executor dispatch. The proxy owns no
    provider credentials and receives trusted runtime state from the deterministic control plane.
    Registering an executor does not bypass mode, state, lock, scope, capability, replay or
    execution-limit checks.
    """

    CODE_ACTIONS = CODE_ACTIONS
    INFRA_ACTIONS = INFRA_ACTIONS
    ALLOWED_WRITERS = {"code_writer", "infra_writer"}
    WRITE_BLOCKED_MODES = {
        SystemMode.OFFLINE,
        SystemMode.READ_ONLY,
        SystemMode.SHADOW,
        SystemMode.EMERGENCY_FREEZE,
    }

    def __init__(self, *, mode_provider: Callable[[], SystemMode],
                 writes_enabled_provider: Callable[[], bool], state: StateStore,
                 locks: ResourceLockManager, max_executions_per_order: int = 1) -> None:
        if max_executions_per_order < 1:
            raise ValueError("max_executions_per_order must be >= 1")
        self._mode_provider = mode_provider
        self._writes_enabled_provider = writes_enabled_provider
        self._state = state
        self._locks = locks
        self._max_executions_per_order = max_executions_per_order
        self._executors: dict[str, Callable[[WorkOrder], dict[str, Any]]] = {}
        self._executed: set[str] = set()
        self._consumed_capabilities: set[str] = set()
        self._executions_by_order: dict[str, int] = {}
        self._mutex = threading.RLock()

    def register_executor(self, action: str, fn: Callable[[WorkOrder], dict[str, Any]]) -> None:
        if action not in (self.CODE_ACTIONS | self.INFRA_ACTIONS):
            raise ValueError("Executor action is outside the canonical action schema")
        self._executors[action] = fn

    def register_mock_executor(self, action: str, fn: Callable[[WorkOrder], dict[str, Any]]) -> None:
        """Backward-compatible Phase-2 registration path."""
        self.register_executor(action, fn)

    def _runtime_gate(self, *, writer_role: str, order: WorkOrder,
                      capability: Capability) -> str | None:
        mode = self._mode_provider()
        if mode in self.WRITE_BLOCKED_MODES:
            return f"MODE_BLOCKS_WRITE:{mode.value}"
        if not self._writes_enabled_provider():
            return "WRITES_DISABLED"

        current_state_version = self._state.snapshot().version
        if (
            order.base_state_version != current_state_version
            or capability.base_state_version != order.base_state_version
        ):
            return "STALE_STATE"

        lock = self._locks.get(order.target)
        if lock is None:
            return "LOCK_MISSING"
        if lock.owner != writer_role or lock.order_id != order.order_id:
            return "LOCK_OWNERSHIP_MISMATCH"
        return None

    def execute(self, *, execution_id: str, writer_role: str, order: WorkOrder,
                capability: Capability) -> ExecutionResult:
        with self._mutex:
            if execution_id in self._executed:
                return ExecutionResult(execution_id, False, "IDEMPOTENCY_REPLAY_BLOCKED", {})
            if capability.capability_id in self._consumed_capabilities:
                return ExecutionResult(execution_id, False, "CAPABILITY_REPLAY_BLOCKED", {})
            if writer_role not in self.ALLOWED_WRITERS:
                return ExecutionResult(execution_id, False, "UNKNOWN_WRITER_DENIED", {})
            if (
                capability.order_id != order.order_id
                or capability.action != order.action
                or capability.target != order.target
                or capability.plan_hash != order.plan_hash
                or capability.base_state_version != order.base_state_version
            ):
                return ExecutionResult(execution_id, False, "CAPABILITY_BINDING_MISMATCH", {})
            if datetime.now(timezone.utc) >= capability.expires_at:
                return ExecutionResult(execution_id, False, "CAPABILITY_EXPIRED", {})
            if writer_role == "code_writer" and order.action not in self.CODE_ACTIONS:
                return ExecutionResult(execution_id, False, "WRITER_SCOPE_DENIED", {})
            if writer_role == "infra_writer" and order.action not in self.INFRA_ACTIONS:
                return ExecutionResult(execution_id, False, "WRITER_SCOPE_DENIED", {})
            if self._executions_by_order.get(order.order_id, 0) >= self._max_executions_per_order:
                return ExecutionResult(execution_id, False, "ORDER_EXECUTION_LIMIT_REACHED", {})

            runtime_denial = self._runtime_gate(
                writer_role=writer_role,
                order=order,
                capability=capability,
            )
            if runtime_denial:
                return ExecutionResult(execution_id, False, runtime_denial, {})

            executor = self._executors.get(order.action)
            if executor is None:
                return ExecutionResult(execution_id, False, "NO_EXECUTOR_REGISTERED", {})

            self._executed.add(execution_id)
            self._consumed_capabilities.add(capability.capability_id)
            self._executions_by_order[order.order_id] = self._executions_by_order.get(order.order_id, 0) + 1

        try:
            output = executor(order)
        except Exception as exc:
            return ExecutionResult(execution_id, False, "EXECUTOR_ERROR_FAIL_CLOSED", {"error_type": type(exc).__name__})

        if not isinstance(output, dict) or output.get("ok") is False:
            return ExecutionResult(execution_id, False, "EXECUTOR_REPORTED_FAILURE", output if isinstance(output, dict) else {})
        success_detail = str(output.get("execution_detail", "MOCK_EXECUTION_OK"))
        return ExecutionResult(execution_id, True, success_detail, output)
