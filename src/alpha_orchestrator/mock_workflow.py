from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Iterable
import json
import uuid

from .models import EvidenceRef, OrderStatus, RiskClass, SystemMode, WorkOrder
from .mock_targets import mock_git_executor, mock_render_executor
from .orchestrator import OrchestratorCore
from .write_proxy import ExecutionResult


@dataclass(frozen=True)
class ReaderReport:
    reader_id: str
    claim: str
    source: str
    reference: str
    observed_payload: dict

    @property
    def evidence(self) -> EvidenceRef:
        raw = json.dumps(self.observed_payload, sort_keys=True, separators=(",", ":"), default=str)
        return EvidenceRef(
            source=self.source,
            reference=self.reference,
            observed_at=str(self.observed_payload.get("observed_at", "MOCK")),
            digest=sha256(raw.encode("utf-8")).hexdigest(),
        )


@dataclass(frozen=True)
class VerificationVerdict:
    evidence_valid: bool
    independent_confirmed: bool
    disputed: bool
    reason: str


@dataclass(frozen=True)
class ApprovalRequest:
    order_id: str
    action: str
    target: str
    base_state_version: str
    expected_effect: str
    risk: str
    plan_hash: str


class MockPipeline:
    """End-to-end mock pipeline.

    Reader content is treated as untrusted data. It cannot directly invoke tools or writers.
    Only a verified WorkOrder can progress to a human approval request.
    """

    def __init__(self) -> None:
        self.core = OrchestratorCore(mode=SystemMode.MOCK, writes_enabled=True)
        for action in self.core.proxy.CODE_ACTIONS:
            self.core.proxy.register_mock_executor(action, mock_git_executor)
        for action in self.core.proxy.INFRA_ACTIONS:
            self.core.proxy.register_mock_executor(action, mock_render_executor)
        self.orders: dict[str, WorkOrder] = {}

    def verify_reports(self, reports: Iterable[ReaderReport], *, force_dispute: bool = False) -> VerificationVerdict:
        reports = list(reports)
        if not reports:
            return VerificationVerdict(False, False, True, "NO_EVIDENCE")
        for report in reports:
            if not report.source or not report.reference or not report.evidence.digest:
                return VerificationVerdict(False, False, True, "INVALID_EVIDENCE")
        if force_dispute:
            return VerificationVerdict(True, False, True, "INDEPENDENT_REVIEW_DISPUTED")
        return VerificationVerdict(True, True, False, "VERIFIED")

    def prepare_order(self, *, reports: Iterable[ReaderReport], action: str, target: str,
                      expected_effect: str, risk: RiskClass = RiskClass.HIGH,
                      force_dispute: bool = False) -> ApprovalRequest | None:
        reports = list(reports)
        verdict = self.verify_reports(reports, force_dispute=force_dispute)
        if verdict.disputed or not verdict.evidence_valid or not verdict.independent_confirmed:
            self.core.audit.append("VERIFICATION_BLOCKED", {"reason": verdict.reason})
            return None

        snapshot = self.core.state.snapshot()
        order = WorkOrder(
            action=action,
            target=target,
            base_state_version=snapshot.version,
            expected_effect=expected_effect,
            risk=risk,
            evidence=[r.evidence for r in reports],
        )
        self.core.register_order(order)
        self.core.mark_verified(order)
        if not self.core.eligible_for_human_gate(order):
            order.status = OrderStatus.BLOCKED
            return None
        self.orders[order.order_id] = order
        self.core.audit.append("HUMAN_APPROVAL_REQUESTED", {
            "order_id": order.order_id,
            "plan_hash": order.plan_hash,
            "risk": order.risk.value,
        })
        return ApprovalRequest(
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            base_state_version=order.base_state_version,
            expected_effect=order.expected_effect,
            risk=order.risk.value,
            plan_hash=order.plan_hash,
        )

    def human_approve(self, request: ApprovalRequest, *, approved_by: str) -> str:
        order = self.orders[request.order_id]
        if request.plan_hash != order.plan_hash:
            raise PermissionError("Approval request no longer matches plan")
        approval = self.core.approvals.grant(
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            plan_hash=order.plan_hash,
            base_state_version=order.base_state_version,
            approved_by=approved_by,
        )
        order.status = OrderStatus.APPROVED
        self.core.audit.append("HUMAN_APPROVAL_GRANTED", {
            "order_id": order.order_id,
            "approval_id": approval.approval_id,
            "plan_hash": order.plan_hash,
        })
        return approval.approval_id

    def execute(self, *, order_id: str, approval_id: str, writer_role: str,
                lock_resource: str, post_verify_pass: bool = True) -> ExecutionResult:
        order = self.orders[order_id]
        lock = self.core.locks.acquire(lock_resource, writer_role, order.order_id)
        if lock is None:
            order.status = OrderStatus.BLOCKED
            self.core.audit.append("LOCK_DENIED", {"order_id": order.order_id, "resource": lock_resource})
            return ExecutionResult("NONE", False, "LOCK_COLLISION", {})

        self.core.audit.append("LOCK_ACQUIRED", {"order_id": order.order_id, "resource": lock_resource, "owner": writer_role})
        try:
            current_state_version = self.core.state.snapshot().version
            gate = self.core.guards.pre_execute(
                order,
                current_state_version=current_state_version,
                lock_resource=lock_resource,
                lock_owner=writer_role,
            )
            if not gate.allowed:
                order.status = OrderStatus.BLOCKED
                self.core.audit.append("EXECUTION_BLOCKED", {"order_id": order.order_id, "reason": gate.reason})
                return ExecutionResult("NONE", False, gate.reason, {})

            capability = self.core.approvals.mint_capability(
                approval_id,
                order_id=order.order_id,
                action=order.action,
                target=order.target,
                plan_hash=order.plan_hash,
                current_state_version=current_state_version,
            )
            execution_id = "EX-" + uuid.uuid4().hex[:16].upper()
            order.status = OrderStatus.EXECUTING
            result = self.core.proxy.execute(
                execution_id=execution_id,
                writer_role=writer_role,
                order=order,
                capability=capability,
            )
            self.core.audit.append("WRITE_EXECUTION", {
                "order_id": order.order_id,
                "execution_id": execution_id,
                "success": result.success,
                "detail": result.detail,
            })
            if not result.success:
                order.status = OrderStatus.FAILED
                self.core.emergency_freeze(f"WRITE_FAILED:{result.detail}")
                return result

            order.status = OrderStatus.POST_VERIFY
            self.core.audit.append("POST_WRITE_VERIFY", {
                "order_id": order.order_id,
                "passed": post_verify_pass,
            })
            if not post_verify_pass:
                order.status = OrderStatus.FAILED
                self.core.emergency_freeze("POST_WRITE_VERIFY_FAILED")
                return ExecutionResult(execution_id, False, "POST_WRITE_VERIFY_FAILED", result.output)

            order.status = OrderStatus.DONE
            self.core.audit.append("ORDER_DONE", {"order_id": order.order_id, "execution_id": execution_id})
            return result
        finally:
            released = self.core.locks.release(lock_resource, writer_role, order.order_id)
            self.core.audit.append("LOCK_RELEASED", {
                "order_id": order.order_id,
                "resource": lock_resource,
                "released": released,
            })
