from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets


@dataclass
class Approval:
    approval_id: str
    order_id: str
    action: str
    target: str
    plan_hash: str
    base_state_version: str
    approved_by: str
    expires_at: datetime
    nonce: str
    used: bool = False


@dataclass(frozen=True)
class Capability:
    capability_id: str
    order_id: str
    action: str
    target: str
    plan_hash: str
    expires_at: datetime


class ApprovalAuthority:
    def __init__(self, required_approver: str = "USER_ONLY", ttl_seconds: int = 300) -> None:
        self.required_approver = required_approver
        self.ttl_seconds = ttl_seconds
        self._approvals: dict[str, Approval] = {}

    def grant(self, *, order_id: str, action: str, target: str, plan_hash: str,
              base_state_version: str, approved_by: str) -> Approval:
        if approved_by != self.required_approver:
            raise PermissionError("Only the configured human authority may approve writes")
        nonce = secrets.token_urlsafe(24)
        raw = f"{order_id}|{action}|{target}|{plan_hash}|{base_state_version}|{nonce}"
        approval_id = "APR-" + sha256(raw.encode()).hexdigest()[:20].upper()
        approval = Approval(
            approval_id=approval_id,
            order_id=order_id,
            action=action,
            target=target,
            plan_hash=plan_hash,
            base_state_version=base_state_version,
            approved_by=approved_by,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds),
            nonce=nonce,
        )
        self._approvals[approval_id] = approval
        return approval

    def mint_capability(self, approval_id: str, *, order_id: str, action: str,
                        target: str, plan_hash: str, current_state_version: str) -> Capability:
        approval = self._approvals.get(approval_id)
        now = datetime.now(timezone.utc)
        if approval is None:
            raise PermissionError("Unknown approval")
        if approval.used:
            raise PermissionError("Approval already used")
        if now >= approval.expires_at:
            raise PermissionError("Approval expired")
        expected = (approval.order_id, approval.action, approval.target, approval.plan_hash,
                    approval.base_state_version)
        actual = (order_id, action, target, plan_hash, current_state_version)
        if expected != actual:
            raise PermissionError("Approval binding mismatch or stale state")
        approval.used = True
        cap_raw = f"{approval.approval_id}|{approval.nonce}|{now.isoformat()}"
        cap_id = "CAP-" + sha256(cap_raw.encode()).hexdigest()[:20].upper()
        return Capability(cap_id, order_id, action, target, plan_hash, approval.expires_at)
