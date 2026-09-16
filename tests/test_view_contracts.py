from alpha_orchestrator.events import AuditEvent
from alpha_orchestrator.guards import GuardDecision
from alpha_orchestrator.locks import ResourceLock
from alpha_orchestrator.models import EvidenceRef, OrderStatus, RiskClass, SystemMode, WorkOrder
from alpha_orchestrator.shadow_read import ShadowFinding
from alpha_orchestrator.shadow_workflow import ShadowPlan
from alpha_orchestrator.state import StateSnapshot
from alpha_orchestrator.view_contracts import (
    ContractName,
    GateId,
    SourceClass,
    ViewContract,
    ViewField,
    agent_view_unavailable,
    audit_view,
    canonical_state_view,
    connector_view_unavailable,
    evidence_view,
    finding_view,
    gate_view,
    lifecycle_view,
    lock_view,
    plan_view,
    provenance_view,
    runtime_view_unavailable,
    system_state_view,
    telemetry_view_unavailable,
    view_payload,
    work_order_view,
    writer_view,
)


def _provenance() -> dict[str, object]:
    return {
        "observation_id": "OBS-1",
        "source": "github",
        "target_id": "github:api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
        "observed_url": "https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
        "status": 200,
        "observed_at": "2026-09-16T18:30:48+00:00",
        "body_digest": "a" * 64,
        "body_size": 7731,
        "freshness_result": "FRESH",
        "freshness_max_age_seconds": 60.0,
        "collector_id": "alpha_orchestrator.read_plane.ReadBroker",
        "transport_id": "alpha_orchestrator.connectors.github_http_transport.GitHubReadTransport",
        "verification_state": "READ_VALIDATED",
    }


def _evidence() -> EvidenceRef:
    return EvidenceRef(
        source="github",
        reference="https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator",
        observed_at="2026-09-16T18:30:48+00:00",
        digest="b" * 64,
    )


def _order() -> WorkOrder:
    return WorkOrder(
        action="git_commit",
        target="repo://alpha-phoenix-labs/alpha-agent-orchestrator/docs/example.md",
        base_state_version="state-v1",
        expected_effect="documentation-only proposal",
        risk=RiskClass.LOW,
        status=OrderStatus.VERIFIED,
        evidence_verified=True,
        independent_review_confirmed=True,
        evidence=[_evidence()],
        order_id="WO-READMODEL",
        created_at="2026-09-16T18:30:48+00:00",
    )


def _plan() -> ShadowPlan:
    return ShadowPlan(
        order_id="WO-READMODEL",
        action="git_commit",
        target="repo://alpha-phoenix-labs/alpha-agent-orchestrator/docs/example.md",
        expected_effect="documentation-only proposal",
        risk="LOW",
        base_state_version="state-v1",
        plan_hash="c" * 64,
        proposed_writer="code_writer",
        evidence=(_evidence(),),
        created_at="2026-09-16T18:30:49+00:00",
        simulation_only=True,
    )


def test_source_classes_are_exact_roadmap_values():
    assert tuple(item.value for item in SourceClass) == (
        "AUTHORITATIVE",
        "WORK_ORDER",
        "EVIDENCE",
        "RUNTIME",
        "TELEMETRY",
        "LOCAL_UI",
    )


def test_unknown_field_is_explicit_and_fail_closed():
    field = ViewField.unknown(SourceClass.RUNTIME, "NO_RUNTIME_AUTHORITY")
    assert field.available is False
    assert field.value is None
    assert field.reason == "NO_RUNTIME_AUTHORITY"


def test_contract_rejects_wrong_source_class():
    try:
        ViewContract(
            ContractName.SYSTEM_STATE,
            {
                "mode": ViewField.known(SourceClass.TELEMETRY, "SHADOW"),
                "writes_enabled": ViewField.known(SourceClass.AUTHORITATIVE, False),
                "state_version": ViewField.known(SourceClass.AUTHORITATIVE, "v1"),
            },
        )
    except ValueError as exc:
        assert str(exc) == "INVALID_SOURCE_CLASS:SYSTEM_STATE:mode"
    else:
        raise AssertionError("telemetry must not become authoritative system state")


def test_system_canonical_and_work_order_views_pin_authority():
    system = system_state_view(
        mode=SystemMode.SHADOW,
        writes_enabled=False,
        snapshot=StateSnapshot(version="state-v1", data={}),
    )
    canonical = canonical_state_view(
        repository="alpha-phoenix-labs/alpha-agent-orchestrator",
        branch="main",
        head_sha="d" * 40,
        observed_at="2026-09-16T18:30:48+00:00",
        freshness_result="FRESH",
    )
    order = _order()
    order_view = work_order_view(order)

    assert system.fields["mode"].source_class is SourceClass.AUTHORITATIVE
    assert system.fields["writes_enabled"].value is False
    assert canonical.fields["head_sha"].source_class is SourceClass.AUTHORITATIVE
    assert order_view.fields["status"].value == "VERIFIED"
    assert order_view.fields["plan_hash"].value == order.plan_hash


def test_canonical_state_can_be_explicitly_unavailable_without_inventing_values():
    view = canonical_state_view(unavailable_reason="CANONICAL_STATE_NOT_OBSERVED")
    assert all(field.available is False for field in view.fields.values())
    assert all(field.source_class is SourceClass.AUTHORITATIVE for field in view.fields.values())


def test_lifecycle_stage_remains_unknown_until_backend_owns_it():
    view = lifecycle_view(_order())
    assert view.fields["order_status"].value == "VERIFIED"
    assert view.fields["stage"].available is False
    assert view.fields["stage"].reason == "NO_AUTHORITATIVE_LIFECYCLE_STAGE"


def test_evidence_finding_and_provenance_preserve_backend_truth():
    finding = ShadowFinding(
        reader_id="github_branch_reader",
        claim="default_branch=main",
        evidence=_evidence(),
        observation_id="OBS-1",
        provenance=_provenance(),
    )
    view = finding_view(finding)
    provenance = view.fields["provenance"].value
    evidence = view.fields["evidence"].value

    assert provenance.fields["status"].value == 200
    assert provenance.fields["verification_state"].value == "READ_VALIDATED"
    assert evidence.fields["verification_state"].value == "READ_VALIDATED"
    assert view.fields["classification"].available is False
    assert view.fields["classification"].reason == "NO_AUTHORITATIVE_FINDING_CLASSIFICATION"


def test_provenance_requires_complete_phase3_contract():
    incomplete = _provenance()
    del incomplete["transport_id"]
    try:
        provenance_view(incomplete)
    except ValueError as exc:
        assert str(exc) == "PROVENANCE_FIELDS_MISSING:transport_id"
    else:
        raise AssertionError("incomplete provenance must fail closed")


def test_evidence_reference_alone_does_not_claim_verification_state():
    view = evidence_view(_evidence())
    assert view.fields["verification_state"].available is False
    assert view.fields["verification_state"].reason == "NO_EVIDENCE_VERIFICATION_STATE_ON_REFERENCE"


def test_plan_writer_gate_and_lock_views_keep_sources_separate():
    plan = _plan()
    plan_contract = plan_view(plan)
    writer = writer_view(plan)
    gate = gate_view(
        GateId.PRE_APPROVAL,
        GuardDecision(allowed=True, reason="ELIGIBLE_FOR_HUMAN_GATE"),
    )
    lock = lock_view(
        ResourceLock(
            resource=plan.target,
            owner="code_writer",
            order_id=plan.order_id,
            acquired_at="2026-09-16T18:30:50+00:00",
        )
    )

    assert plan_contract.fields["proposed_writer"].source_class is SourceClass.WORK_ORDER
    assert writer.fields["writer_id"].value == "code_writer"
    assert writer.fields["proposal_only"].value is True
    assert writer.fields["runtime_state"].available is False
    assert gate.fields["gate_id"].value == "PRE_APPROVAL"
    assert gate.fields["allowed"].source_class is SourceClass.AUTHORITATIVE
    assert lock.fields["resource"].source_class is SourceClass.AUTHORITATIVE


def test_agent_connector_runtime_and_telemetry_are_explicitly_unavailable():
    reason = "NO_AUTHORITATIVE_RUNTIME_CONTRACT"
    agent = agent_view_unavailable(reason)
    connector = connector_view_unavailable(reason)
    runtime = runtime_view_unavailable(reason)
    telemetry = telemetry_view_unavailable("NO_TELEMETRY_SOURCE")

    assert agent.fields["health"].source_class is SourceClass.RUNTIME
    assert agent.fields["health"].available is False
    assert connector.fields["auth_state"].available is False
    assert runtime.fields["state"].available is False
    assert telemetry.fields["metrics"].source_class is SourceClass.TELEMETRY
    assert telemetry.fields["metrics"].available is False


def test_audit_contract_exposes_chain_identity_but_not_raw_payload():
    event = AuditEvent(
        seq=1,
        event_type="SHADOW_PLAN_CREATED",
        payload={"possibly_sensitive": "not-for-ui"},
        created_at="2026-09-16T18:30:51+00:00",
        prev_hash="GENESIS",
        event_hash="e" * 64,
    )
    view = audit_view(event)

    assert view.fields["seq"].value == 1
    assert view.fields["event_hash"].value == "e" * 64
    assert view.fields["payload"].available is False
    assert view.fields["payload"].reason == "RAW_AUDIT_PAYLOAD_NOT_UI_SAFE"


def test_payload_keeps_authority_and_unknown_metadata():
    payload = view_payload(lifecycle_view(_order()))
    assert payload["contract"] == "LIFECYCLE"
    assert payload["fields"]["order_status"] == {
        "source_class": "WORK_ORDER",
        "available": True,
        "value": "VERIFIED",
        "reason": None,
    }
    assert payload["fields"]["stage"] == {
        "source_class": "WORK_ORDER",
        "available": False,
        "value": None,
        "reason": "NO_AUTHORITATIVE_LIFECYCLE_STAGE",
    }
