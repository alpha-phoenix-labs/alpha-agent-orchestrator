from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping

from .events import AuditEvent
from .guards import GuardDecision
from .locks import ResourceLock
from .models import EvidenceRef, SystemMode, WorkOrder
from .shadow_read import ShadowFinding
from .shadow_workflow import ShadowPlan
from .state import StateSnapshot


class SourceClass(str, Enum):
    AUTHORITATIVE = "AUTHORITATIVE"
    WORK_ORDER = "WORK_ORDER"
    EVIDENCE = "EVIDENCE"
    RUNTIME = "RUNTIME"
    TELEMETRY = "TELEMETRY"
    APPROVAL = "APPROVAL"
    CAPABILITY = "CAPABILITY"
    EXECUTION = "EXECUTION"
    POST_VERIFY = "POST_VERIFY"
    LOCAL_UI = "LOCAL_UI"


class ContractName(str, Enum):
    SYSTEM_STATE = "SYSTEM_STATE"
    CANONICAL_STATE = "CANONICAL_STATE"
    WORK_ORDER = "WORK_ORDER"
    LIFECYCLE = "LIFECYCLE"
    EVIDENCE = "EVIDENCE"
    FINDING = "FINDING"
    PROVENANCE = "PROVENANCE"
    PLAN = "PLAN"
    GATE = "GATE"
    LOCK = "LOCK"
    WRITER = "WRITER"
    AGENT = "AGENT"
    CONNECTOR = "CONNECTOR"
    AUDIT = "AUDIT"
    RUNTIME = "RUNTIME"
    TELEMETRY = "TELEMETRY"


class GateId(str, Enum):
    PRE_APPROVAL = "PRE_APPROVAL"
    PRE_EXECUTE = "PRE_EXECUTE"


@dataclass(frozen=True)
class ViewField:
    source_class: SourceClass
    value: object | None = None
    available: bool = True
    reason: str | None = None

    def __post_init__(self) -> None:
        if self.available and self.reason is not None:
            raise ValueError("AVAILABLE_FIELD_CANNOT_HAVE_UNAVAILABLE_REASON")
        if not self.available:
            if self.value is not None:
                raise ValueError("UNAVAILABLE_FIELD_CANNOT_HAVE_VALUE")
            if not self.reason:
                raise ValueError("UNAVAILABLE_FIELD_REQUIRES_REASON")

    @classmethod
    def known(cls, source_class: SourceClass, value: object) -> "ViewField":
        return cls(source_class=source_class, value=value)

    @classmethod
    def unknown(cls, source_class: SourceClass, reason: str) -> "ViewField":
        return cls(source_class=source_class, available=False, reason=reason)


_EXPECTED_SOURCES: dict[ContractName, dict[str, SourceClass]] = {
    ContractName.SYSTEM_STATE: {
        "mode": SourceClass.AUTHORITATIVE,
        "writes_enabled": SourceClass.AUTHORITATIVE,
        "state_version": SourceClass.AUTHORITATIVE,
    },
    ContractName.CANONICAL_STATE: {
        "repository": SourceClass.AUTHORITATIVE,
        "branch": SourceClass.AUTHORITATIVE,
        "head_sha": SourceClass.AUTHORITATIVE,
        "observed_at": SourceClass.AUTHORITATIVE,
        "freshness_result": SourceClass.AUTHORITATIVE,
    },
    ContractName.WORK_ORDER: {
        name: SourceClass.WORK_ORDER
        for name in (
            "order_id", "action", "target", "base_state_version", "expected_effect",
            "risk", "status", "evidence_verified", "independent_review_confirmed",
            "plan_hash", "created_at",
        )
    },
    ContractName.LIFECYCLE: {
        "order_status": SourceClass.WORK_ORDER,
        "stage": SourceClass.WORK_ORDER,
    },
    ContractName.EVIDENCE: {
        name: SourceClass.EVIDENCE
        for name in ("source", "reference", "observed_at", "digest", "verification_state")
    },
    ContractName.PROVENANCE: {
        name: SourceClass.EVIDENCE
        for name in (
            "observation_id", "source", "target_id", "observed_url", "status",
            "observed_at", "body_digest", "body_size", "freshness_result",
            "freshness_max_age_seconds", "collector_id", "transport_id",
            "verification_state",
        )
    },
    ContractName.FINDING: {
        name: SourceClass.EVIDENCE
        for name in ("reader_id", "claim", "observation_id", "evidence", "provenance", "classification")
    },
    ContractName.PLAN: {
        name: SourceClass.WORK_ORDER
        for name in (
            "order_id", "action", "target", "expected_effect", "risk",
            "base_state_version", "plan_hash", "proposed_writer",
            "created_at", "simulation_only",
        )
    },
    ContractName.GATE: {
        name: SourceClass.AUTHORITATIVE for name in ("gate_id", "allowed", "reason")
    },
    ContractName.LOCK: {
        name: SourceClass.AUTHORITATIVE for name in ("resource", "owner", "order_id", "acquired_at")
    },
    ContractName.WRITER: {
        "writer_id": SourceClass.WORK_ORDER,
        "proposal_only": SourceClass.WORK_ORDER,
        "runtime_state": SourceClass.RUNTIME,
    },
    ContractName.AGENT: {
        "agent_id": SourceClass.AUTHORITATIVE,
        "role": SourceClass.AUTHORITATIVE,
        "health": SourceClass.RUNTIME,
        "runtime_state": SourceClass.RUNTIME,
        "activity": SourceClass.RUNTIME,
    },
    ContractName.CONNECTOR: {
        "connector_id": SourceClass.AUTHORITATIVE,
        "state": SourceClass.RUNTIME,
        "health": SourceClass.RUNTIME,
        "auth_state": SourceClass.RUNTIME,
    },
    ContractName.AUDIT: {
        name: SourceClass.AUTHORITATIVE
        for name in ("seq", "event_type", "created_at", "prev_hash", "event_hash", "payload")
    },
    ContractName.RUNTIME: {
        "state": SourceClass.RUNTIME,
        "observed_at": SourceClass.RUNTIME,
    },
    ContractName.TELEMETRY: {
        "metrics": SourceClass.TELEMETRY,
        "observed_at": SourceClass.TELEMETRY,
    },
    ContractName.APPROVAL: {
        name: SourceClass.AUTHORITATIVE
        for name in (
            "approval_id", "order_id", "action", "target", "base_sha",
            "base_state_version", "plan_hash", "risk", "expires_at", "state",
        )
    },
    ContractName.CAPABILITY: {
        name: SourceClass.AUTHORITATIVE
        for name in ("capability_id", "order_id", "scope", "target", "expires_at", "consumed_state")
    },
    ContractName.EXECUTION: {
        name: SourceClass.AUTHORITATIVE
        for name in ("execution_id", "order_id", "state", "detail")
    },
    ContractName.POST_VERIFY: {
        name: SourceClass.AUTHORITATIVE
        for name in ("order_id", "state", "reason", "observed_sha", "artifact_digest")
    },
}


@dataclass(frozen=True)
class ViewContract:
    contract: ContractName
    fields: Mapping[str, ViewField]

    def __post_init__(self) -> None:
        expected = _EXPECTED_SOURCES[self.contract]
        if set(self.fields) != set(expected):
            raise ValueError(f"INVALID_CONTRACT_FIELDS:{self.contract.value}")
        for name, source_class in expected.items():
            if self.fields[name].source_class is not source_class:
                raise ValueError(f"INVALID_SOURCE_CLASS:{self.contract.value}:{name}")


def _known(source_class: SourceClass, **values: object) -> dict[str, ViewField]:
    return {name: ViewField.known(source_class, value) for name, value in values.items()}


def system_state_view(*, mode: SystemMode, writes_enabled: bool, snapshot: StateSnapshot) -> ViewContract:
    return ViewContract(
        ContractName.SYSTEM_STATE,
        _known(
            SourceClass.AUTHORITATIVE,
            mode=mode.value,
            writes_enabled=writes_enabled,
            state_version=snapshot.version,
        ),
    )


def canonical_state_view(
    *,
    repository: str | None = None,
    branch: str | None = None,
    head_sha: str | None = None,
    observed_at: str | None = None,
    freshness_result: str | None = None,
    unavailable_reason: str | None = None,
) -> ViewContract:
    names = ("repository", "branch", "head_sha", "observed_at", "freshness_result")
    values = (repository, branch, head_sha, observed_at, freshness_result)
    if unavailable_reason is not None:
        if any(value is not None for value in values):
            raise ValueError("CANONICAL_STATE_CANNOT_MIX_VALUE_AND_UNAVAILABLE_REASON")
        data = {
            name: ViewField.unknown(SourceClass.AUTHORITATIVE, unavailable_reason)
            for name in names
        }
    else:
        if any(value is None or value == "" for value in values):
            raise ValueError("CANONICAL_STATE_FIELDS_REQUIRED")
        data = {
            name: ViewField.known(SourceClass.AUTHORITATIVE, value)
            for name, value in zip(names, values, strict=True)
        }
    return ViewContract(ContractName.CANONICAL_STATE, data)


def work_order_view(order: WorkOrder) -> ViewContract:
    return ViewContract(
        ContractName.WORK_ORDER,
        _known(
            SourceClass.WORK_ORDER,
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            base_state_version=order.base_state_version,
            expected_effect=order.expected_effect,
            risk=order.risk.value,
            status=order.status.value,
            evidence_verified=order.evidence_verified,
            independent_review_confirmed=order.independent_review_confirmed,
            plan_hash=order.plan_hash,
            created_at=order.created_at,
        ),
    )


def lifecycle_view(order: WorkOrder) -> ViewContract:
    return ViewContract(
        ContractName.LIFECYCLE,
        {
            "order_status": ViewField.known(SourceClass.WORK_ORDER, order.status.value),
            "stage": ViewField.unknown(
                SourceClass.WORK_ORDER, "NO_AUTHORITATIVE_LIFECYCLE_STAGE"
            ),
        },
    )


def evidence_view(evidence: EvidenceRef, *, verification_state: str | None = None) -> ViewContract:
    data = _known(
        SourceClass.EVIDENCE,
        source=evidence.source,
        reference=evidence.reference,
        observed_at=evidence.observed_at,
        digest=evidence.digest,
    )
    data["verification_state"] = (
        ViewField.known(SourceClass.EVIDENCE, verification_state)
        if verification_state is not None
        else ViewField.unknown(
            SourceClass.EVIDENCE, "NO_EVIDENCE_VERIFICATION_STATE_ON_REFERENCE"
        )
    )
    return ViewContract(ContractName.EVIDENCE, data)


_PROVENANCE_FIELDS = tuple(_EXPECTED_SOURCES[ContractName.PROVENANCE])


def provenance_view(provenance: Mapping[str, object]) -> ViewContract:
    missing = sorted(name for name in _PROVENANCE_FIELDS if name not in provenance)
    if missing:
        raise ValueError("PROVENANCE_FIELDS_MISSING:" + ",".join(missing))
    return ViewContract(
        ContractName.PROVENANCE,
        {
            name: ViewField.known(SourceClass.EVIDENCE, provenance[name])
            for name in _PROVENANCE_FIELDS
        },
    )


def finding_view(finding: ShadowFinding) -> ViewContract:
    verification_state = finding.provenance.get("verification_state")
    return ViewContract(
        ContractName.FINDING,
        {
            "reader_id": ViewField.known(SourceClass.EVIDENCE, finding.reader_id),
            "claim": ViewField.known(SourceClass.EVIDENCE, finding.claim),
            "observation_id": ViewField.known(SourceClass.EVIDENCE, finding.observation_id),
            "evidence": ViewField.known(
                SourceClass.EVIDENCE,
                evidence_view(
                    finding.evidence,
                    verification_state=(
                        str(verification_state) if verification_state is not None else None
                    ),
                ),
            ),
            "provenance": ViewField.known(
                SourceClass.EVIDENCE, provenance_view(finding.provenance)
            ),
            "classification": ViewField.unknown(
                SourceClass.EVIDENCE, "NO_AUTHORITATIVE_FINDING_CLASSIFICATION"
            ),
        },
    )


def plan_view(plan: ShadowPlan) -> ViewContract:
    return ViewContract(
        ContractName.PLAN,
        _known(
            SourceClass.WORK_ORDER,
            order_id=plan.order_id,
            action=plan.action,
            target=plan.target,
            expected_effect=plan.expected_effect,
            risk=plan.risk,
            base_state_version=plan.base_state_version,
            plan_hash=plan.plan_hash,
            proposed_writer=plan.proposed_writer,
            created_at=plan.created_at,
            simulation_only=plan.simulation_only,
        ),
    )


def gate_view(gate_id: GateId, decision: GuardDecision) -> ViewContract:
    return ViewContract(
        ContractName.GATE,
        _known(
            SourceClass.AUTHORITATIVE,
            gate_id=gate_id.value,
            allowed=decision.allowed,
            reason=decision.reason,
        ),
    )


def lock_view(lock: ResourceLock) -> ViewContract:
    return ViewContract(
        ContractName.LOCK,
        _known(
            SourceClass.AUTHORITATIVE,
            resource=lock.resource,
            owner=lock.owner,
            order_id=lock.order_id,
            acquired_at=lock.acquired_at,
        ),
    )


def writer_view(plan: ShadowPlan) -> ViewContract:
    return ViewContract(
        ContractName.WRITER,
        {
            "writer_id": ViewField.known(SourceClass.WORK_ORDER, plan.proposed_writer),
            "proposal_only": ViewField.known(SourceClass.WORK_ORDER, True),
            "runtime_state": ViewField.unknown(
                SourceClass.RUNTIME, "NO_AUTHORITATIVE_WRITER_RUNTIME_STATE"
            ),
        },
    )


def agent_view_unavailable(reason: str) -> ViewContract:
    return ViewContract(
        ContractName.AGENT,
        {
            "agent_id": ViewField.unknown(SourceClass.AUTHORITATIVE, reason),
            "role": ViewField.unknown(SourceClass.AUTHORITATIVE, reason),
            "health": ViewField.unknown(SourceClass.RUNTIME, reason),
            "runtime_state": ViewField.unknown(SourceClass.RUNTIME, reason),
            "activity": ViewField.unknown(SourceClass.RUNTIME, reason),
        },
    )


def connector_view_unavailable(reason: str) -> ViewContract:
    return ViewContract(
        ContractName.CONNECTOR,
        {
            "connector_id": ViewField.unknown(SourceClass.AUTHORITATIVE, reason),
            "state": ViewField.unknown(SourceClass.RUNTIME, reason),
            "health": ViewField.unknown(SourceClass.RUNTIME, reason),
            "auth_state": ViewField.unknown(SourceClass.RUNTIME, reason),
        },
    )


def audit_view(event: AuditEvent) -> ViewContract:
    data = _known(
        SourceClass.AUTHORITATIVE,
        seq=event.seq,
        event_type=event.event_type,
        created_at=event.created_at,
        prev_hash=event.prev_hash,
        event_hash=event.event_hash,
    )
    data["payload"] = ViewField.unknown(
        SourceClass.AUTHORITATIVE, "RAW_AUDIT_PAYLOAD_NOT_UI_SAFE"
    )
    return ViewContract(ContractName.AUDIT, data)


def approval_view(
    *,
    approval_id: str,
    order_id: str,
    action: str,
    target: str,
    base_sha: str,
    base_state_version: str,
    plan_hash: str,
    risk: str,
    expires_at: str,
    state: str,
) -> ViewContract:
    return ViewContract(
        ContractName.APPROVAL,
        _known(
            SourceClass.AUTHORITATIVE,
            approval_id=approval_id,
            order_id=order_id,
            action=action,
            target=target,
            base_sha=base_sha,
            base_state_version=base_state_version,
            plan_hash=plan_hash,
            risk=risk,
            expires_at=expires_at,
            state=state,
        ),
    )


def capability_view(
    *,
    capability_id: str,
    order_id: str,
    scope: str,
    target: str,
    expires_at: str,
    consumed_state: str,
) -> ViewContract:
    return ViewContract(
        ContractName.CAPABILITY,
        _known(
            SourceClass.AUTHORITATIVE,
            capability_id=capability_id,
            order_id=order_id,
            scope=scope,
            target=target,
            expires_at=expires_at,
            consumed_state=consumed_state,
        ),
    )


def execution_view(
    *, execution_id: str, order_id: str, state: str, detail: str
) -> ViewContract:
    return ViewContract(
        ContractName.EXECUTION,
        _known(
            SourceClass.AUTHORITATIVE,
            execution_id=execution_id,
            order_id=order_id,
            state=state,
            detail=detail,
        ),
    )


def post_verify_view(
    *,
    order_id: str,
    state: str,
    reason: str,
    observed_sha: str,
    artifact_digest: str,
) -> ViewContract:
    return ViewContract(
        ContractName.POST_VERIFY,
        _known(
            SourceClass.AUTHORITATIVE,
            order_id=order_id,
            state=state,
            reason=reason,
            observed_sha=observed_sha,
            artifact_digest=artifact_digest,
        ),
    )


def runtime_view_unavailable(reason: str) -> ViewContract:
    return ViewContract(
        ContractName.RUNTIME,
        {
            "state": ViewField.unknown(SourceClass.RUNTIME, reason),
            "observed_at": ViewField.unknown(SourceClass.RUNTIME, reason),
        },
    )


def telemetry_view_unavailable(reason: str) -> ViewContract:
    return ViewContract(
        ContractName.TELEMETRY,
        {
            "metrics": ViewField.unknown(SourceClass.TELEMETRY, reason),
            "observed_at": ViewField.unknown(SourceClass.TELEMETRY, reason),
        },
    )


def view_payload(value: object) -> object:
    """Serialize a view contract without dropping authority or availability metadata."""

    if isinstance(value, ViewContract):
        return {
            "contract": value.contract.value,
            "fields": {name: view_payload(field) for name, field in value.fields.items()},
        }
    if isinstance(value, ViewField):
        return {
            "source_class": value.source_class.value,
            "available": value.available,
            "value": view_payload(value.value),
            "reason": value.reason,
        }
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Mapping):
        return {str(key): view_payload(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [view_payload(item) for item in value]
    if isinstance(value, list):
        return [view_payload(item) for item in value]
    return value
