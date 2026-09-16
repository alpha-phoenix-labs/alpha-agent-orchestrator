from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
import json
import uuid

from .models import EvidenceRef, RiskClass, SystemMode, WorkOrder
from .shadow_read import ShadowFinding
from .state import StateStore


class ShadowWorkflowError(RuntimeError):
    pass


@dataclass(frozen=True)
class ShadowPlan:
    order_id: str
    action: str
    target: str
    expected_effect: str
    risk: str
    base_state_version: str
    plan_hash: str
    proposed_writer: str
    evidence: tuple[EvidenceRef, ...]
    created_at: str
    simulation_only: bool = True


@dataclass(frozen=True)
class ShadowAcknowledgement:
    acknowledgement_id: str
    order_id: str
    plan_hash: str
    acknowledged_by: str
    acknowledged_at: str
    simulation_only: bool = True


@dataclass(frozen=True)
class ShadowSimulationResult:
    simulation_id: str
    order_id: str
    plan_hash: str
    proposed_writer: str
    would_execute: bool
    external_write_performed: bool
    detail: str
    simulated_steps: tuple[str, ...] = field(default_factory=tuple)


class ShadowWorkflow:
    """Full pre-live workflow with a hard no-write invariant.

    This class deliberately imports neither ApprovalAuthority nor WriteProxy. Human interaction
    in SHADOW mode is an acknowledgement of an exact plan, not a write approval and never
    produces an execution capability.
    """

    CODE_ACTIONS = frozenset({"git_commit", "git_branch", "git_pr", "git_merge"})
    INFRA_ACTIONS = frozenset({"render_deploy", "render_config_change", "db_migration"})
    ALLOWED_READERS = frozenset({
        "github_branch_reader", "render_service_reader", "ci_pipeline_reader",
        "security_reader", "database_reader", "runtime_reader", "api_contract_reader",
        "visual_pipeline_reader", "observability_reader", "dependency_supply_chain_reader",
    })

    def __init__(self, *, state: StateStore | None = None) -> None:
        self.mode = SystemMode.SHADOW
        self.writes_enabled = False
        self.state = state or StateStore({"system_mode": self.mode.value, "writes_enabled": False})
        self._plans: dict[str, ShadowPlan] = {}
        self._acks: dict[str, ShadowAcknowledgement] = {}
        self.events: list[dict] = []

    def _event(self, event_type: str, payload: dict) -> None:
        self.events.append({
            "event_type": event_type,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "payload": dict(payload),
        })

    @classmethod
    def _writer_for(cls, action: str) -> str:
        if action in cls.CODE_ACTIONS:
            return "code_writer"
        if action in cls.INFRA_ACTIONS:
            return "infra_writer"
        raise ShadowWorkflowError("ACTION_NOT_ALLOWLISTED")

    @staticmethod
    def _verify_findings(findings: list[ShadowFinding]) -> tuple[EvidenceRef, ...]:
        if not findings:
            raise ShadowWorkflowError("NO_EVIDENCE")
        seen: set[tuple[str, str, str]] = set()
        evidence: list[EvidenceRef] = []
        for finding in findings:
            if finding.reader_id not in ShadowWorkflow.ALLOWED_READERS:
                raise ShadowWorkflowError("UNKNOWN_READER")
            ref = finding.evidence
            if not (ref.source and ref.reference and ref.observed_at and ref.digest):
                raise ShadowWorkflowError("INVALID_EVIDENCE")
            key = (ref.source, ref.reference, ref.digest)
            if key in seen:
                raise ShadowWorkflowError("DUPLICATE_EVIDENCE")
            seen.add(key)
            evidence.append(ref)
        return tuple(evidence)

    def propose(self, *, findings: list[ShadowFinding], action: str, target: str,
                expected_effect: str, risk: RiskClass = RiskClass.HIGH,
                independent_review_confirmed: bool = True) -> ShadowPlan:
        if self.mode != SystemMode.SHADOW or self.writes_enabled:
            raise ShadowWorkflowError("SHADOW_INVARIANT_BROKEN")
        evidence = self._verify_findings(findings)
        if not independent_review_confirmed:
            self._event("SHADOW_PLAN_BLOCKED", {"reason": "INDEPENDENT_REVIEW_DISPUTED"})
            raise ShadowWorkflowError("INDEPENDENT_REVIEW_DISPUTED")
        writer = self._writer_for(action)
        snap = self.state.snapshot()
        order = WorkOrder(
            action=action,
            target=target,
            base_state_version=snap.version,
            expected_effect=expected_effect,
            risk=risk,
            evidence=list(evidence),
        )
        plan = ShadowPlan(
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            expected_effect=order.expected_effect,
            risk=order.risk.value,
            base_state_version=order.base_state_version,
            plan_hash=order.plan_hash,
            proposed_writer=writer,
            evidence=evidence,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._plans[plan.order_id] = plan
        self._event("SHADOW_PLAN_CREATED", {
            "order_id": plan.order_id,
            "plan_hash": plan.plan_hash,
            "proposed_writer": writer,
            "simulation_only": True,
        })
        return plan

    def acknowledge(self, *, order_id: str, plan_hash: str, acknowledged_by: str) -> ShadowAcknowledgement:
        if acknowledged_by != "USER_ONLY":
            raise PermissionError("Only the configured human authority may acknowledge a shadow plan")
        plan = self._plans.get(order_id)
        if plan is None:
            raise ShadowWorkflowError("UNKNOWN_ORDER")
        if plan.plan_hash != plan_hash:
            raise PermissionError("PLAN_HASH_MISMATCH")
        if self.state.snapshot().version != plan.base_state_version:
            raise PermissionError("STALE_STATE")
        raw = f"{order_id}|{plan_hash}|{acknowledged_by}|{uuid.uuid4().hex}"
        ack = ShadowAcknowledgement(
            acknowledgement_id="SHACK-" + sha256(raw.encode()).hexdigest()[:20].upper(),
            order_id=order_id,
            plan_hash=plan_hash,
            acknowledged_by=acknowledged_by,
            acknowledged_at=datetime.now(timezone.utc).isoformat(),
        )
        self._acks[ack.acknowledgement_id] = ack
        self._event("SHADOW_PLAN_ACKNOWLEDGED", {
            "order_id": order_id,
            "plan_hash": plan_hash,
            "acknowledgement_id": ack.acknowledgement_id,
            "simulation_only": True,
        })
        return ack

    def simulate(self, *, order_id: str, acknowledgement_id: str) -> ShadowSimulationResult:
        plan = self._plans.get(order_id)
        ack = self._acks.get(acknowledgement_id)
        if plan is None or ack is None:
            raise ShadowWorkflowError("UNKNOWN_PLAN_OR_ACK")
        if (ack.order_id, ack.plan_hash) != (plan.order_id, plan.plan_hash):
            raise PermissionError("ACK_BINDING_MISMATCH")
        if self.state.snapshot().version != plan.base_state_version:
            raise PermissionError("STALE_STATE")
        if self.mode != SystemMode.SHADOW or self.writes_enabled:
            raise ShadowWorkflowError("SHADOW_INVARIANT_BROKEN")

        result = ShadowSimulationResult(
            simulation_id="SIM-" + uuid.uuid4().hex[:16].upper(),
            order_id=plan.order_id,
            plan_hash=plan.plan_hash,
            proposed_writer=plan.proposed_writer,
            would_execute=True,
            external_write_performed=False,
            detail="SHADOW_SIMULATION_ONLY",
            simulated_steps=(
                "REVALIDATE_STATE",
                "ACQUIRE_RESOURCE_LOCK",
                f"DISPATCH_TO:{plan.proposed_writer}",
                f"WOULD_EXECUTE:{plan.action}",
                "POST_WRITE_VERIFY",
                "RELEASE_RESOURCE_LOCK",
            ),
        )
        self._event("SHADOW_SIMULATION_COMPLETED", {
            "order_id": plan.order_id,
            "simulation_id": result.simulation_id,
            "external_write_performed": False,
        })
        return result

    @property
    def capabilities_issued(self) -> int:
        return 0

    @property
    def external_writes_performed(self) -> int:
        return 0
