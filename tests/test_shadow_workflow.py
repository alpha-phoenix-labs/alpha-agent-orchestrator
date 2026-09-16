from dataclasses import replace
from datetime import datetime, timedelta, timezone
import pytest

from alpha_orchestrator.models import EvidenceRef, RiskClass, SystemMode
from alpha_orchestrator.shadow_read import ShadowFinding
from alpha_orchestrator.shadow_workflow import ShadowWorkflow, ShadowWorkflowError
from alpha_orchestrator.write_proxy import WriteProxy


def finding(reader="github_branch_reader", digest="a" * 64, ref="https://api.github.com/repos/o/r"):
    observed_at = datetime.now(timezone.utc).isoformat()
    return ShadowFinding(
        reader_id=reader,
        claim="observed branch state",
        evidence=EvidenceRef(
            source="github",
            reference=ref,
            observed_at=observed_at,
            digest=digest,
        ),
        observation_id="OBS-123",
        provenance={
            "observation_id": "OBS-123",
            "source": "github",
            "target_id": "github:api.github.com/repos/o/r",
            "observed_url": ref,
            "status": 200,
            "observed_at": observed_at,
            "body_digest": "b" * 64,
            "body_size": 128,
            "freshness_result": "FRESH",
            "freshness_max_age_seconds": 60,
            "collector_id": "alpha_orchestrator.read_plane.ReadBroker",
            "transport_id": "alpha_orchestrator.connectors.github_http_transport.GitHubReadTransport",
            "verification_state": "READ_VALIDATED",
        },
    )


def make_plan(wf=None, action="git_commit"):
    wf = wf or ShadowWorkflow()
    plan = wf.propose(
        findings=[finding()],
        action=action,
        target="mock://target",
        expected_effect="planned change",
        independent_review_confirmed=True,
        risk=RiskClass.HIGH,
    )
    return wf, plan


def test_shadow_mode_is_hard_read_only():
    wf = ShadowWorkflow()
    assert wf.mode == SystemMode.SHADOW
    assert wf.writes_enabled is False
    assert wf.external_writes_performed == 0
    assert wf.capabilities_issued == 0


def test_real_reader_finding_can_create_shadow_plan():
    wf, plan = make_plan()
    assert plan.simulation_only is True
    assert plan.proposed_writer == "code_writer"
    assert len(plan.evidence) == 1


def test_infra_action_routes_to_infra_writer():
    wf, plan = make_plan(action="render_deploy")
    assert plan.proposed_writer == "infra_writer"


def test_unknown_action_fails_closed():
    wf = ShadowWorkflow()
    with pytest.raises(ShadowWorkflowError, match="ACTION_NOT_ALLOWLISTED"):
        wf.propose(findings=[finding()], action="shell", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_unknown_reader_fails_closed():
    wf = ShadowWorkflow()
    with pytest.raises(ShadowWorkflowError, match="UNKNOWN_READER"):
        wf.propose(findings=[finding(reader="rogue_reader")], action="git_commit", target="x",
                   expected_effect="x", independent_review_confirmed=True)


def test_duplicate_evidence_is_rejected():
    wf = ShadowWorkflow()
    f = finding()
    with pytest.raises(ShadowWorkflowError, match="DUPLICATE_EVIDENCE"):
        wf.propose(findings=[f, f], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_missing_provenance_is_rejected():
    wf = ShadowWorkflow()
    missing = replace(finding(), provenance={})
    with pytest.raises(ShadowWorkflowError, match="INVALID_PROVENANCE"):
        wf.propose(findings=[missing], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_non_fresh_provenance_is_rejected():
    wf = ShadowWorkflow()
    fresh = finding()
    stale_provenance = dict(fresh.provenance)
    stale_provenance["freshness_result"] = "STALE"
    stale = replace(fresh, provenance=stale_provenance)
    with pytest.raises(ShadowWorkflowError, match="PROVENANCE_NOT_FRESH"):
        wf.propose(findings=[stale], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_fresh_label_cannot_hide_stale_timestamp_at_planning_time():
    wf = ShadowWorkflow()
    current = finding()
    stale_at = (datetime.now(timezone.utc) - timedelta(seconds=61)).isoformat()
    stale_provenance = dict(current.provenance)
    stale_provenance["observed_at"] = stale_at
    stale = replace(
        current,
        evidence=replace(current.evidence, observed_at=stale_at),
        provenance=stale_provenance,
    )
    with pytest.raises(ShadowWorkflowError, match="PROVENANCE_NOT_FRESH"):
        wf.propose(findings=[stale], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_invalid_http_status_is_rejected_as_provenance():
    wf = ShadowWorkflow()
    current = finding()
    invalid_provenance = dict(current.provenance)
    invalid_provenance["status"] = 500
    invalid = replace(current, provenance=invalid_provenance)
    with pytest.raises(ShadowWorkflowError, match="INVALID_PROVENANCE"):
        wf.propose(findings=[invalid], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=True)


def test_disputed_independent_review_blocks_plan():
    wf = ShadowWorkflow()
    with pytest.raises(ShadowWorkflowError, match="INDEPENDENT_REVIEW_DISPUTED"):
        wf.propose(findings=[finding()], action="git_commit", target="x", expected_effect="x",
                   independent_review_confirmed=False)


def test_independent_review_must_be_explicit():
    wf = ShadowWorkflow()
    with pytest.raises(TypeError):
        wf.propose(findings=[finding()], action="git_commit", target="x", expected_effect="x")


def test_shadow_and_write_proxy_share_canonical_actions():
    assert ShadowWorkflow.CODE_ACTIONS == WriteProxy.CODE_ACTIONS
    assert ShadowWorkflow.INFRA_ACTIONS == WriteProxy.INFRA_ACTIONS
    assert "db_migration" not in ShadowWorkflow.INFRA_ACTIONS
    assert "pull_request" in ShadowWorkflow.CODE_ACTIONS
    assert "merge" in ShadowWorkflow.CODE_ACTIONS
    assert "approved_runtime_config" in ShadowWorkflow.INFRA_ACTIONS


def test_only_user_can_acknowledge_shadow_plan():
    wf, plan = make_plan()
    with pytest.raises(PermissionError):
        wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="LEADER")


def test_ack_is_bound_to_exact_plan_hash():
    wf, plan = make_plan()
    with pytest.raises(PermissionError, match="PLAN_HASH_MISMATCH"):
        wf.acknowledge(order_id=plan.order_id, plan_hash="0" * 64, acknowledged_by="USER_ONLY")


def test_state_change_before_ack_blocks_ack():
    wf, plan = make_plan()
    wf.state.update({"external_change": True})
    with pytest.raises(PermissionError, match="STALE_STATE"):
        wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="USER_ONLY")


def test_state_change_after_ack_blocks_simulation():
    wf, plan = make_plan()
    ack = wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="USER_ONLY")
    wf.state.update({"external_change": True})
    with pytest.raises(PermissionError, match="STALE_STATE"):
        wf.simulate(order_id=plan.order_id, acknowledgement_id=ack.acknowledgement_id)


def test_shadow_simulation_never_performs_external_write():
    wf, plan = make_plan()
    ack = wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="USER_ONLY")
    result = wf.simulate(order_id=plan.order_id, acknowledgement_id=ack.acknowledgement_id)
    assert result.would_execute is True
    assert result.external_write_performed is False
    assert result.detail == "SHADOW_SIMULATION_ONLY"
    assert wf.external_writes_performed == 0
    assert wf.capabilities_issued == 0


def test_shadow_workflow_has_no_write_proxy_or_approval_authority_surface():
    wf = ShadowWorkflow()
    assert not hasattr(wf, "write_proxy")
    assert not hasattr(wf, "proxy")
    assert not hasattr(wf, "approvals")


def test_shadow_events_record_no_write_execution():
    wf, plan = make_plan()
    ack = wf.acknowledge(order_id=plan.order_id, plan_hash=plan.plan_hash, acknowledged_by="USER_ONLY")
    wf.simulate(order_id=plan.order_id, acknowledgement_id=ack.acknowledgement_id)
    event_types = [e["event_type"] for e in wf.events]
    assert "SHADOW_SIMULATION_COMPLETED" in event_types
    assert "WRITE_EXECUTION" not in event_types
