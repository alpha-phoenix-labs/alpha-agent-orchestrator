from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
import json
import uuid


class SystemMode(str, Enum):
    OFFLINE = "OFFLINE"
    MOCK = "MOCK"
    READ_ONLY = "READ_ONLY"
    SHADOW = "SHADOW"
    SANDBOX_WRITE = "SANDBOX_WRITE"
    LIVE_GATED = "LIVE_GATED"
    EMERGENCY_FREEZE = "EMERGENCY_FREEZE"


class RiskClass(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    VERIFIED = "VERIFIED"
    DISPUTED = "DISPUTED"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    POST_VERIFY = "POST_VERIFY"
    DONE = "DONE"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class EvidenceRef:
    source: str
    reference: str
    observed_at: str
    digest: str


@dataclass
class WorkOrder:
    action: str
    target: str
    base_state_version: str
    expected_effect: str
    risk: RiskClass = RiskClass.HIGH
    order_id: str = field(default_factory=lambda: f"WO-{uuid.uuid4().hex[:12].upper()}")
    status: OrderStatus = OrderStatus.DRAFT
    evidence_verified: bool = False
    independent_review_confirmed: bool = False
    evidence: list[EvidenceRef] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def canonical_plan(self) -> dict:
        return {
            "order_id": self.order_id,
            "action": self.action,
            "target": self.target,
            "base_state_version": self.base_state_version,
            "expected_effect": self.expected_effect,
            "risk": self.risk.value,
        }

    @property
    def plan_hash(self) -> str:
        raw = json.dumps(self.canonical_plan(), sort_keys=True, separators=(",", ":"))
        return sha256(raw.encode("utf-8")).hexdigest()
