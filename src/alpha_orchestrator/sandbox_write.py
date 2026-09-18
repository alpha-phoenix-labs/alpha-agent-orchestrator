from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import json
from pathlib import Path
import re
import secrets
import subprocess
import threading
from typing import Any

from .events import AuditLog
from .models import EvidenceRef, OrderStatus, RiskClass, SystemMode, WorkOrder
from .orchestrator import OrchestratorCore
from .write_proxy import ExecutionResult
from .view_contracts import (
    ViewContract,
    approval_view,
    audit_view,
    capability_view,
    execution_view,
    post_verify_view,
    work_order_view,
)


_SANDBOX_TARGET_ID = re.compile(r"^[A-Za-z0-9._-]+$")
_PROOF_FILE = ".alpha-phase5-sandbox-proof.json"


@dataclass(frozen=True)
class SandboxApprovalRequest:
    order_id: str
    action: str
    target: str
    base_sha: str
    base_state_version: str
    expected_effect: str
    risk: str
    plan_hash: str


@dataclass(frozen=True)
class SandboxCredential:
    credential_id: str
    order_id: str
    action: str
    target: str
    expires_at: datetime
    token: str


@dataclass(frozen=True)
class SandboxCredentialMetadata:
    credential_id: str
    order_id: str
    action: str
    target: str
    expires_at: str
    consumed: bool


@dataclass
class _CredentialRecord:
    credential_id: str
    order_id: str
    action: str
    target: str
    expires_at: datetime
    token_digest: str
    consumed: bool = False


class SandboxCredentialAuthority:
    """Backend-owned short-lived credential authority for isolated Phase-5 sandbox writes.

    The raw token is never written to Audit. The authority stores only a digest and exposes
    non-secret metadata separately.
    """

    def __init__(self, *, ttl_seconds: int = 120) -> None:
        if ttl_seconds < 1:
            raise ValueError("ttl_seconds must be >= 1")
        self._ttl_seconds = ttl_seconds
        self._records: dict[str, _CredentialRecord] = {}
        self._lock = threading.RLock()

    def issue(self, *, order: WorkOrder) -> SandboxCredential:
        now = datetime.now(timezone.utc)
        token = secrets.token_urlsafe(32)
        material = f"{order.order_id}|{order.action}|{order.target}|{now.isoformat()}|{token}"
        credential_id = "SBOX-" + sha256(material.encode("utf-8")).hexdigest()[:20].upper()
        record = _CredentialRecord(
            credential_id=credential_id,
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            expires_at=now + timedelta(seconds=self._ttl_seconds),
            token_digest=sha256(token.encode("utf-8")).hexdigest(),
        )
        with self._lock:
            self._records[credential_id] = record
        return SandboxCredential(
            credential_id=credential_id,
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            expires_at=record.expires_at,
            token=token,
        )

    def consume(self, credential: SandboxCredential, *, order: WorkOrder) -> None:
        with self._lock:
            record = self._records.get(credential.credential_id)
            if record is None:
                raise PermissionError("Unknown sandbox credential")
            if record.consumed:
                raise PermissionError("Sandbox credential already consumed")
            if datetime.now(timezone.utc) >= record.expires_at:
                raise PermissionError("Sandbox credential expired")
            expected = (record.order_id, record.action, record.target)
            actual = (order.order_id, order.action, order.target)
            if expected != actual:
                raise PermissionError("Sandbox credential binding mismatch")
            supplied_digest = sha256(credential.token.encode("utf-8")).hexdigest()
            if not hmac.compare_digest(supplied_digest, record.token_digest):
                raise PermissionError("Sandbox credential authentication failed")
            record.consumed = True

    def metadata(self, credential_id: str) -> SandboxCredentialMetadata:
        with self._lock:
            record = self._records[credential_id]
            return SandboxCredentialMetadata(
                credential_id=record.credential_id,
                order_id=record.order_id,
                action=record.action,
                target=record.target,
                expires_at=record.expires_at.isoformat(),
                consumed=record.consumed,
            )


@dataclass(frozen=True)
class SandboxGitTarget:
    target_id: str
    repo_path: Path

    @property
    def uri(self) -> str:
        return f"sandbox-git://{self.target_id}"

    def _git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=self.repo_path,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.stdout.strip()

    def current_head(self) -> str:
        return self._git("rev-parse", "HEAD")

    def write_proof_commit(self, order: WorkOrder) -> dict[str, Any]:
        proof = {
            "order_id": order.order_id,
            "action": order.action,
            "target": order.target,
            "plan_hash": order.plan_hash,
            "base_state_version": order.base_state_version,
            "expected_effect": order.expected_effect,
        }
        raw = json.dumps(proof, sort_keys=True, separators=(",", ":")) + "\n"
        artifact = self.repo_path / _PROOF_FILE
        artifact.write_text(raw, encoding="utf-8")
        self._git("add", "--", _PROOF_FILE)
        self._git("commit", "-m", f"Phase 5 sandbox proof {order.order_id}")
        commit_sha = self.current_head()
        return {
            "ok": True,
            "sandbox": True,
            "execution_detail": "SANDBOX_EXECUTION_OK",
            "target": order.target,
            "commit_sha": commit_sha,
            "artifact_digest": sha256(raw.encode("utf-8")).hexdigest(),
        }


class SandboxGitTargetRegistry:
    """Maps logical sandbox target IDs to backend-owned local repository paths."""

    def __init__(self, *, root_dir: Path) -> None:
        self.root_dir = root_dir.resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self._targets: dict[str, SandboxGitTarget] = {}

    def register(self, *, target_id: str, repo_path: Path) -> SandboxGitTarget:
        if not _SANDBOX_TARGET_ID.fullmatch(target_id):
            raise ValueError("Invalid sandbox target id")
        resolved = repo_path.resolve()
        if not resolved.is_relative_to(self.root_dir):
            raise ValueError("Sandbox target escapes configured root")
        if not (resolved / ".git").exists():
            raise ValueError("Sandbox target is not a git repository")
        target = SandboxGitTarget(target_id=target_id, repo_path=resolved)
        self._targets[target.uri] = target
        return target

    def resolve(self, target_uri: str) -> SandboxGitTarget:
        target = self._targets.get(target_uri)
        if target is None:
            raise PermissionError("Unknown sandbox target")
        return target


@dataclass(frozen=True)
class SandboxPolicyDecision:
    allowed: bool
    reason: str


class SandboxPolicy:
    """Phase-5 policy boundary: one explicit action on one registered sandbox target."""

    def __init__(self, registry: SandboxGitTargetRegistry) -> None:
        self.registry = registry

    def evaluate(self, order: WorkOrder) -> SandboxPolicyDecision:
        if order.action != "git_commit":
            return SandboxPolicyDecision(False, "SANDBOX_ACTION_DENIED")
        try:
            self.registry.resolve(order.target)
        except PermissionError:
            return SandboxPolicyDecision(False, "SANDBOX_TARGET_DENIED")
        return SandboxPolicyDecision(True, "SANDBOX_POLICY_PASS")


class SandboxGitExecutor:
    def __init__(
        self,
        *,
        registry: SandboxGitTargetRegistry,
        credentials: SandboxCredentialAuthority,
    ) -> None:
        self._registry = registry
        self._credentials = credentials
        self._pending: dict[str, SandboxCredential] = {}
        self._lock = threading.RLock()

    def bind_credential(self, *, order: WorkOrder, credential: SandboxCredential) -> None:
        with self._lock:
            if order.order_id in self._pending:
                raise PermissionError("Sandbox credential already bound for order")
            if (
                credential.order_id != order.order_id
                or credential.action != order.action
                or credential.target != order.target
            ):
                raise PermissionError("Sandbox credential binding mismatch")
            self._pending[order.order_id] = credential

    def __call__(self, order: WorkOrder) -> dict[str, Any]:
        with self._lock:
            credential = self._pending.pop(order.order_id, None)
        if credential is None:
            return {"ok": False, "reason": "SANDBOX_CREDENTIAL_MISSING"}

        try:
            self._credentials.consume(credential, order=order)
            target = self._registry.resolve(order.target)
            output = target.write_proof_commit(order)
        except (PermissionError, ValueError, OSError, subprocess.SubprocessError):
            return {"ok": False, "reason": "SANDBOX_EXECUTOR_FAIL_CLOSED"}

        output["credential_id"] = credential.credential_id
        return output


@dataclass(frozen=True)
class SandboxPostVerifyResult:
    passed: bool
    reason: str
    observed_sha: str
    artifact_digest: str


class SandboxPostVerifier:
    def __init__(self, registry: SandboxGitTargetRegistry) -> None:
        self._registry = registry

    def verify(self, *, order: WorkOrder, execution: ExecutionResult) -> SandboxPostVerifyResult:
        if not execution.success:
            return SandboxPostVerifyResult(False, "EXECUTION_NOT_SUCCESSFUL", "", "")
        target = self._registry.resolve(order.target)
        artifact = target.repo_path / _PROOF_FILE
        if not artifact.exists():
            return SandboxPostVerifyResult(False, "PROOF_ARTIFACT_MISSING", target.current_head(), "")
        raw = artifact.read_text(encoding="utf-8")
        digest = sha256(raw.encode("utf-8")).hexdigest()
        observed_sha = target.current_head()
        if execution.output.get("commit_sha") != observed_sha:
            return SandboxPostVerifyResult(False, "COMMIT_SHA_MISMATCH", observed_sha, digest)
        if execution.output.get("artifact_digest") != digest:
            return SandboxPostVerifyResult(False, "ARTIFACT_DIGEST_MISMATCH", observed_sha, digest)
        try:
            proof = json.loads(raw)
        except json.JSONDecodeError:
            return SandboxPostVerifyResult(False, "PROOF_ARTIFACT_INVALID", observed_sha, digest)
        expected = {
            "order_id": order.order_id,
            "action": order.action,
            "target": order.target,
            "plan_hash": order.plan_hash,
            "base_state_version": order.base_state_version,
            "expected_effect": order.expected_effect,
        }
        if proof != expected:
            return SandboxPostVerifyResult(False, "PROOF_BINDING_MISMATCH", observed_sha, digest)
        return SandboxPostVerifyResult(True, "POST_VERIFY_PASS", observed_sha, digest)


class SandboxPipeline:
    """First real Phase-5 write path, restricted to a local git sandbox.

    Preparation can stop at the Human Gate without issuing a sandbox credential or
    executing any write. Execution remains user-approval bound through the existing
    ApprovalAuthority and single-use capability path.
    """

    def __init__(
        self,
        *,
        root_dir: Path,
        target_id: str,
        repo_path: Path,
        credential_ttl_seconds: int = 120,
    ) -> None:
        self.registry = SandboxGitTargetRegistry(root_dir=root_dir)
        self.target = self.registry.register(target_id=target_id, repo_path=repo_path)
        self.core = OrchestratorCore(mode=SystemMode.SANDBOX_WRITE, writes_enabled=True)
        self.credentials = SandboxCredentialAuthority(ttl_seconds=credential_ttl_seconds)
        self.policy = SandboxPolicy(self.registry)
        self.executor = SandboxGitExecutor(registry=self.registry, credentials=self.credentials)
        self.post_verifier = SandboxPostVerifier(self.registry)
        self.core.proxy.register_executor("git_commit", self.executor)
        self.orders: dict[str, WorkOrder] = {}
        self.requests: dict[str, SandboxApprovalRequest] = {}
        self._approval_state: dict[str, dict[str, str | None]] = {}
        self._capability_state: dict[str, dict[str, str]] = {}
        self._execution_state: dict[str, dict[str, str]] = {}
        self._post_verify_state: dict[str, dict[str, str]] = {}

    def _sync_target_state(self) -> tuple[str, str]:
        base_sha = self.target.current_head()
        snapshot = self.core.state.update(
            {
                "sandbox_target": self.target.uri,
                "sandbox_base_sha": base_sha,
            }
        )
        return base_sha, snapshot.version

    def prepare_order(
        self,
        *,
        expected_effect: str,
        risk: RiskClass = RiskClass.HIGH,
        order_id: str | None = None,
    ) -> SandboxApprovalRequest | None:
        base_sha, state_version = self._sync_target_state()
        evidence_raw = f"{self.target.uri}|{base_sha}"
        order = WorkOrder(
            action="git_commit",
            target=self.target.uri,
            base_state_version=state_version,
            expected_effect=expected_effect,
            risk=risk,
            evidence=[
                EvidenceRef(
                    source="SANDBOX_GIT_LOCAL",
                    reference=f"{self.target.uri}@{base_sha}",
                    observed_at=datetime.now(timezone.utc).isoformat(),
                    digest=sha256(evidence_raw.encode("utf-8")).hexdigest(),
                )
            ],
            **({"order_id": order_id} if order_id is not None else {}),
        )
        self.core.register_order(order)

        policy = self.policy.evaluate(order)
        self.core.audit.append(
            "SANDBOX_POLICY_GATE",
            {"order_id": order.order_id, "allowed": policy.allowed, "reason": policy.reason},
        )
        if not policy.allowed:
            order.status = OrderStatus.BLOCKED
            return None

        self.core.mark_verified(order)
        if not self.core.eligible_for_human_gate(order):
            order.status = OrderStatus.BLOCKED
            return None

        request = SandboxApprovalRequest(
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            base_sha=base_sha,
            base_state_version=order.base_state_version,
            expected_effect=order.expected_effect,
            risk=order.risk.value,
            plan_hash=order.plan_hash,
        )
        self.orders[order.order_id] = order
        self.requests[order.order_id] = request
        self._approval_state[order.order_id] = {
            "approval_id": None,
            "expires_at": None,
            "state": "PENDING",
        }
        self.core.audit.append(
            "HUMAN_APPROVAL_REQUESTED",
            {
                "order_id": order.order_id,
                "action": order.action,
                "target": order.target,
                "base_sha": base_sha,
                "base_state_version": order.base_state_version,
                "plan_hash": order.plan_hash,
                "risk": order.risk.value,
            },
        )
        return request

    def human_approve(self, request: SandboxApprovalRequest, *, approved_by: str) -> str:
        order = self.orders[request.order_id]
        if request != self.requests[request.order_id]:
            raise PermissionError("Approval request no longer matches prepared binding")
        approval = self.core.approvals.grant(
            order_id=order.order_id,
            action=order.action,
            target=order.target,
            plan_hash=order.plan_hash,
            base_state_version=order.base_state_version,
            approved_by=approved_by,
        )
        order.status = OrderStatus.APPROVED
        self._approval_state[order.order_id] = {
            "approval_id": approval.approval_id,
            "expires_at": approval.expires_at.isoformat(),
            "state": "APPROVED",
        }
        self.core.audit.append(
            "HUMAN_APPROVAL_GRANTED",
            {
                "order_id": order.order_id,
                "approval_id": approval.approval_id,
                "plan_hash": order.plan_hash,
            },
        )
        return approval.approval_id

    def execute(
        self,
        *,
        order_id: str,
        approval_id: str,
        writer_role: str = "code_writer",
    ) -> ExecutionResult:
        order = self.orders[order_id]
        request = self.requests[order_id]

        observed_sha = self.target.current_head()
        if observed_sha != request.base_sha:
            self.core.state.update({"sandbox_base_sha": observed_sha})
            order.status = OrderStatus.BLOCKED
            self.core.audit.append(
                "EXECUTION_BLOCKED",
                {"order_id": order.order_id, "reason": "SANDBOX_BASE_SHA_CHANGED"},
            )
            return ExecutionResult("NONE", False, "SANDBOX_BASE_SHA_CHANGED", {})

        lock = self.core.locks.acquire(order.target, writer_role, order.order_id)
        if lock is None:
            order.status = OrderStatus.BLOCKED
            self.core.audit.append(
                "LOCK_DENIED",
                {"order_id": order.order_id, "resource": order.target},
            )
            return ExecutionResult("NONE", False, "LOCK_COLLISION", {})

        self.core.audit.append(
            "LOCK_ACQUIRED",
            {"order_id": order.order_id, "resource": order.target, "owner": writer_role},
        )
        try:
            current_state_version = self.core.state.snapshot().version
            gate = self.core.guards.pre_execute(
                order,
                current_state_version=current_state_version,
                lock_owner=writer_role,
            )
            if not gate.allowed:
                order.status = OrderStatus.BLOCKED
                self.core.audit.append(
                    "EXECUTION_BLOCKED",
                    {"order_id": order.order_id, "reason": gate.reason},
                )
                return ExecutionResult("NONE", False, gate.reason, {})

            capability = self.core.approvals.mint_capability(
                approval_id,
                order_id=order.order_id,
                action=order.action,
                target=order.target,
                plan_hash=order.plan_hash,
                current_state_version=current_state_version,
            )
            self._capability_state[order.order_id] = {
                "capability_id": capability.capability_id,
                "scope": order.action,
                "target": order.target,
                "expires_at": capability.expires_at.isoformat(),
                "consumed_state": "ISSUED",
            }
            credential = self.credentials.issue(order=order)
            self.executor.bind_credential(order=order, credential=credential)
            credential_meta = self.credentials.metadata(credential.credential_id)
            self.core.audit.append(
                "SANDBOX_CREDENTIAL_ISSUED",
                {
                    "order_id": order.order_id,
                    "credential_id": credential_meta.credential_id,
                    "action": credential_meta.action,
                    "target": credential_meta.target,
                    "expires_at": credential_meta.expires_at,
                },
            )

            execution_id = "EX-" + secrets.token_hex(8).upper()
            order.status = OrderStatus.EXECUTING
            result = self.core.proxy.execute(
                execution_id=execution_id,
                writer_role=writer_role,
                order=order,
                capability=capability,
            )
            self._capability_state[order.order_id]["consumed_state"] = "CONSUMED"
            self._execution_state[order.order_id] = {
                "execution_id": execution_id,
                "state": "COMPLETED" if result.success else "FAILED",
                "detail": result.detail,
            }
            self.core.audit.append(
                "WRITE_EXECUTION",
                {
                    "order_id": order.order_id,
                    "execution_id": execution_id,
                    "success": result.success,
                    "detail": result.detail,
                    "credential_id": credential_meta.credential_id,
                },
            )
            if not result.success:
                order.status = OrderStatus.FAILED
                self.core.emergency_freeze(f"WRITE_FAILED:{result.detail}")
                return result

            order.status = OrderStatus.POST_VERIFY
            post = self.post_verifier.verify(order=order, execution=result)
            self._post_verify_state[order.order_id] = {
                "state": "PASSED" if post.passed else "FAILED",
                "reason": post.reason,
                "observed_sha": post.observed_sha,
                "artifact_digest": post.artifact_digest,
            }
            self.core.audit.append(
                "POST_WRITE_VERIFY",
                {
                    "order_id": order.order_id,
                    "passed": post.passed,
                    "reason": post.reason,
                    "observed_sha": post.observed_sha,
                    "artifact_digest": post.artifact_digest,
                },
            )
            if not post.passed:
                order.status = OrderStatus.FAILED
                self.core.emergency_freeze(f"POST_WRITE_VERIFY_FAILED:{post.reason}")
                return ExecutionResult(
                    execution_id,
                    False,
                    "POST_WRITE_VERIFY_FAILED",
                    result.output,
                )

            self.core.state.update({"sandbox_base_sha": post.observed_sha})
            order.status = OrderStatus.DONE
            self.core.audit.append(
                "ORDER_DONE",
                {"order_id": order.order_id, "execution_id": execution_id},
            )
            return result
        finally:
            released = self.core.locks.release(order.target, writer_role, order.order_id)
            self.core.audit.append(
                "LOCK_RELEASED",
                {
                    "order_id": order.order_id,
                    "resource": order.target,
                    "released": released,
                },
            )


    def control_contracts(self, order_id: str) -> tuple[ViewContract, ...]:
        order = self.orders[order_id]
        request = self.requests[order_id]
        approval = self._approval_state[order_id]
        contracts: list[ViewContract] = [
            work_order_view(order),
            approval_view(
                approval_id=approval["approval_id"],
                order_id=order.order_id,
                action=order.action,
                target=order.target,
                base_sha=request.base_sha,
                base_state_version=order.base_state_version,
                plan_hash=order.plan_hash,
                risk=order.risk.value,
                expires_at=approval["expires_at"],
                state=str(approval["state"]),
            ),
        ]

        capability = self._capability_state.get(order_id)
        if capability is not None:
            contracts.append(
                capability_view(
                    capability_id=capability["capability_id"],
                    order_id=order_id,
                    scope=capability["scope"],
                    target=capability["target"],
                    expires_at=capability["expires_at"],
                    consumed_state=capability["consumed_state"],
                )
            )

        execution = self._execution_state.get(order_id)
        if execution is not None:
            contracts.append(
                execution_view(
                    execution_id=execution["execution_id"],
                    order_id=order_id,
                    state=execution["state"],
                    detail=execution["detail"],
                )
            )

        post_verify = self._post_verify_state.get(order_id)
        if post_verify is not None:
            contracts.append(
                post_verify_view(
                    order_id=order_id,
                    state=post_verify["state"],
                    reason=post_verify["reason"],
                    observed_sha=post_verify["observed_sha"],
                    artifact_digest=post_verify["artifact_digest"],
                )
            )

        contracts.extend(audit_view(event) for event in self.core.audit.events)
        return tuple(contracts)


def audit_contains_secret(audit: AuditLog, secret: str) -> bool:
    encoded = json.dumps(
        [
            {
                "event_type": event.event_type,
                "payload": event.payload,
            }
            for event in audit.events
        ],
        sort_keys=True,
        default=str,
    )
    return secret in encoded
