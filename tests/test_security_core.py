from dataclasses import replace

from alpha_orchestrator.approvals import ApprovalAuthority
from alpha_orchestrator.events import AuditLog
from alpha_orchestrator.guards import ControlGuards
from alpha_orchestrator.locks import ResourceLockManager
from alpha_orchestrator.models import RiskClass, SystemMode, WorkOrder
from alpha_orchestrator.state import StateStore
from alpha_orchestrator.write_proxy import WriteProxy


def make_verified_order(state_version: str, action: str = "git_commit") -> WorkOrder:
    order = WorkOrder(
        action=action,
        target="mock://target",
        base_state_version=state_version,
        expected_effect="mock change",
        risk=RiskClass.HIGH,
    )
    order.evidence_verified = True
    order.independent_review_confirmed = True
    return order


def make_capability(auth: ApprovalAuthority, state: StateStore, order: WorkOrder):
    approval = auth.grant(
        order_id=order.order_id,
        action=order.action,
        target=order.target,
        plan_hash=order.plan_hash,
        base_state_version=order.base_state_version,
        approved_by="USER_ONLY",
    )
    return auth.mint_capability(
        approval.approval_id,
        order_id=order.order_id,
        action=order.action,
        target=order.target,
        plan_hash=order.plan_hash,
        current_state_version=state.snapshot().version,
    )


def make_proxy(*, state: StateStore, locks: ResourceLockManager,
               mode: SystemMode = SystemMode.MOCK, writes_enabled: bool = True,
               max_executions_per_order: int = 1) -> WriteProxy:
    return WriteProxy(
        mode_provider=lambda: mode,
        writes_enabled_provider=lambda: writes_enabled,
        state=state,
        locks=locks,
        max_executions_per_order=max_executions_per_order,
    )


def test_offline_mode_blocks_write():
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    guards = ControlGuards(mode=SystemMode.OFFLINE, writes_enabled=False, locks=locks)
    decision = guards.pre_execute(order, current_state_version=state.snapshot().version,
                                  lock_owner="code_writer")
    assert not decision.allowed


def test_only_user_can_approve():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    order = make_verified_order(state.snapshot().version)
    try:
        auth.grant(order_id=order.order_id, action=order.action, target=order.target,
                   plan_hash=order.plan_hash, base_state_version=order.base_state_version,
                   approved_by="LEADER")
    except PermissionError:
        pass
    else:
        raise AssertionError("non-human approval accepted")


def test_state_change_invalidates_approval():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    initial = state.snapshot()
    order = make_verified_order(initial.version)
    approval = auth.grant(order_id=order.order_id, action=order.action, target=order.target,
                          plan_hash=order.plan_hash, base_state_version=order.base_state_version,
                          approved_by="USER_ONLY")
    changed = state.update({"x": 2})
    try:
        auth.mint_capability(approval.approval_id, order_id=order.order_id,
                             action=order.action, target=order.target,
                             plan_hash=order.plan_hash,
                             current_state_version=changed.version)
    except PermissionError:
        pass
    else:
        raise AssertionError("stale approval was accepted")


def test_approval_is_single_use():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    order = make_verified_order(state.snapshot().version)
    approval = auth.grant(order_id=order.order_id, action=order.action, target=order.target,
                          plan_hash=order.plan_hash, base_state_version=order.base_state_version,
                          approved_by="USER_ONLY")
    auth.mint_capability(approval.approval_id, order_id=order.order_id, action=order.action,
                         target=order.target, plan_hash=order.plan_hash,
                         current_state_version=state.snapshot().version)
    try:
        auth.mint_capability(approval.approval_id, order_id=order.order_id, action=order.action,
                             target=order.target, plan_hash=order.plan_hash,
                             current_state_version=state.snapshot().version)
    except PermissionError:
        pass
    else:
        raise AssertionError("approval replay accepted")


def test_second_approval_for_same_order_is_denied():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    order = make_verified_order(state.snapshot().version)
    auth.grant(order_id=order.order_id, action=order.action, target=order.target,
               plan_hash=order.plan_hash, base_state_version=order.base_state_version,
               approved_by="USER_ONLY")
    try:
        auth.grant(order_id=order.order_id, action=order.action, target=order.target,
                   plan_hash=order.plan_hash, base_state_version=order.base_state_version,
                   approved_by="USER_ONLY")
    except PermissionError as exc:
        assert "already granted" in str(exc)
    else:
        raise AssertionError("second approval for same order accepted")


def test_atomic_resource_lock_collision():
    locks = ResourceLockManager()
    assert locks.acquire("render:service-x", "infra_writer", "WO-1")
    assert locks.acquire("render:service-x", "infra_writer", "WO-2") is None


def test_writer_scope_isolated():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version, action="render_deploy")
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("render_deploy", lambda o: {"ok": True})
    result = proxy.execute(execution_id="EX-1", writer_role="code_writer", order=order, capability=cap)
    assert not result.success
    assert result.detail == "WRITER_SCOPE_DENIED"


def test_execution_id_replay_blocked():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    first = proxy.execute(execution_id="EX-REPLAY", writer_role="code_writer", order=order, capability=cap)
    second = proxy.execute(execution_id="EX-REPLAY", writer_role="code_writer", order=order, capability=cap)
    assert first.success
    assert not second.success
    assert second.detail == "IDEMPOTENCY_REPLAY_BLOCKED"


def test_audit_chain_valid():
    log = AuditLog()
    log.append("A", {"x": 1})
    log.append("B", {"y": 2})
    assert log.verify_chain()


def test_capability_is_single_use_even_with_new_execution_id():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    first = proxy.execute(execution_id="EX-CAP-1", writer_role="code_writer", order=order, capability=cap)
    second = proxy.execute(execution_id="EX-CAP-2", writer_role="code_writer", order=order, capability=cap)
    assert first.success
    assert not second.success
    assert second.detail == "CAPABILITY_REPLAY_BLOCKED"


def test_unknown_writer_role_is_denied():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    result = proxy.execute(execution_id="EX-UNKNOWN", writer_role="leader", order=order, capability=cap)
    assert not result.success
    assert result.detail == "UNKNOWN_WRITER_DENIED"


def test_executor_failure_is_fail_closed():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": False, "reason": "simulated"})
    result = proxy.execute(execution_id="EX-FAIL", writer_role="code_writer", order=order, capability=cap)
    assert not result.success
    assert result.detail == "EXECUTOR_REPORTED_FAILURE"


def test_direct_proxy_execution_is_denied_in_offline_mode():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks, mode=SystemMode.OFFLINE, writes_enabled=False)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    result = proxy.execute(execution_id="EX-OFFLINE", writer_role="code_writer", order=order, capability=cap)
    assert not result.success
    assert result.detail == "MODE_BLOCKS_WRITE:OFFLINE"


def test_state_change_after_capability_mint_is_denied_by_proxy():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    state.update({"x": 2})
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    result = proxy.execute(execution_id="EX-STALE-CAP", writer_role="code_writer", order=order, capability=cap)
    assert not result.success
    assert result.detail == "STALE_STATE"


def test_proxy_requires_lock_for_exact_order_target():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire("mock://different-target", "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    result = proxy.execute(execution_id="EX-WRONG-LOCK", writer_role="code_writer", order=order, capability=cap)
    assert not result.success
    assert result.detail == "LOCK_MISSING"


def test_proxy_enforces_max_executions_per_order():
    auth = ApprovalAuthority(required_approver="USER_ONLY")
    state = StateStore({"x": 1})
    locks = ResourceLockManager()
    order = make_verified_order(state.snapshot().version)
    cap = make_capability(auth, state, order)
    assert locks.acquire(order.target, "code_writer", order.order_id)
    proxy = make_proxy(state=state, locks=locks, max_executions_per_order=1)
    proxy.register_mock_executor("git_commit", lambda o: {"ok": True})
    first = proxy.execute(execution_id="EX-ORDER-1", writer_role="code_writer", order=order, capability=cap)
    second_cap = replace(cap, capability_id="CAP-SECOND")
    second = proxy.execute(execution_id="EX-ORDER-2", writer_role="code_writer", order=order, capability=second_cap)
    assert first.success
    assert not second.success
    assert second.detail == "ORDER_EXECUTION_LIMIT_REACHED"
