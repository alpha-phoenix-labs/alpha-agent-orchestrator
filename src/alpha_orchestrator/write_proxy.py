from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Any

from .approvals import Capability
from .models import WorkOrder


@dataclass(frozen=True)
class ExecutionResult:
    execution_id: str
    success: bool
    detail: str
    output: dict[str, Any]


class WriteProxy:
    """Deterministic choke point. Mock-only until a later explicit integration phase.

    Security invariants:
    - deny unknown writer roles
    - bind capability to order/action/target/plan hash
    - single-use capabilities
    - idempotent execution ids
    - fail closed on executor errors or explicit executor failure
    """

    CODE_ACTIONS = {"git_commit", "git_branch", "pull_request", "merge"}
    INFRA_ACTIONS = {"render_deploy", "approved_runtime_config"}
    ALLOWED_WRITERS = {"code_writer", "infra_writer"}

    def __init__(self) -> None:
        self._executors: dict[str, Callable[[WorkOrder], dict[str, Any]]] = {}
        self._executed: set[str] = set()
        self._consumed_capabilities: set[str] = set()

    def register_mock_executor(self, action: str, fn: Callable[[WorkOrder], dict[str, Any]]) -> None:
        self._executors[action] = fn

    def execute(self, *, execution_id: str, writer_role: str, order: WorkOrder,
                capability: Capability) -> ExecutionResult:
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
        ):
            return ExecutionResult(execution_id, False, "CAPABILITY_BINDING_MISMATCH", {})
        if datetime.now(timezone.utc) >= capability.expires_at:
            return ExecutionResult(execution_id, False, "CAPABILITY_EXPIRED", {})
        if writer_role == "code_writer" and order.action not in self.CODE_ACTIONS:
            return ExecutionResult(execution_id, False, "WRITER_SCOPE_DENIED", {})
        if writer_role == "infra_writer" and order.action not in self.INFRA_ACTIONS:
            return ExecutionResult(execution_id, False, "WRITER_SCOPE_DENIED", {})
        executor = self._executors.get(order.action)
        if executor is None:
            return ExecutionResult(execution_id, False, "NO_EXECUTOR_REGISTERED", {})

        self._executed.add(execution_id)
        self._consumed_capabilities.add(capability.capability_id)
        try:
            output = executor(order)
        except Exception as exc:
            return ExecutionResult(execution_id, False, "EXECUTOR_ERROR_FAIL_CLOSED", {"error_type": type(exc).__name__})

        if not isinstance(output, dict) or output.get("ok") is False:
            return ExecutionResult(execution_id, False, "EXECUTOR_REPORTED_FAILURE", output if isinstance(output, dict) else {})
        return ExecutionResult(execution_id, True, "MOCK_EXECUTION_OK", output)
