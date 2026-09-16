from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
import uuid

from .models import RiskClass
from .shadow_read import ShadowFinding, ShadowReadService
from .shadow_workflow import ShadowPlan, ShadowWorkflow, ShadowWorkflowError


ClaimBuilder = Callable[[object], object]
IndependentReviewer = Callable[[tuple[ShadowFinding, ...]], bool]


@dataclass(frozen=True)
class ShadowReadStep:
    reader_id: str
    source_id: str
    url: str
    claim_builder: ClaimBuilder


@dataclass(frozen=True)
class ShadowTaskRequest:
    reads: tuple[ShadowReadStep, ...]
    action: str
    target: str
    expected_effect: str
    risk: RiskClass = RiskClass.HIGH


@dataclass(frozen=True)
class ShadowTaskResult:
    request_id: str
    findings: tuple[ShadowFinding, ...]
    plan: ShadowPlan
    independent_review_confirmed: bool
    capabilities_issued: int
    external_writes_performed: int


class ShadowTaskRunner:
    """Phase-4 request-to-plan orchestration with a hard no-write boundary.

    Real reads are delegated to ``ShadowReadService``. Evidence/provenance validation and
    plan construction remain delegated to ``ShadowWorkflow``. This runner deliberately has
    no acknowledgement, capability-minting, WriteProxy or executor surface.
    """

    def __init__(self, *, read_service: ShadowReadService, workflow: ShadowWorkflow | None = None) -> None:
        self.read_service = read_service
        self.workflow = workflow or ShadowWorkflow()

    def run(self, *, request: ShadowTaskRequest, independent_reviewer: IndependentReviewer) -> ShadowTaskResult:
        if not request.reads:
            raise ShadowWorkflowError("NO_READ_REQUESTS")
        if self.workflow.writes_enabled or self.workflow.capabilities_issued != 0:
            raise ShadowWorkflowError("SHADOW_INVARIANT_BROKEN")

        findings = tuple(
            self.read_service.inspect_json(
                reader_id=step.reader_id,
                source_id=step.source_id,
                url=step.url,
                claim_builder=step.claim_builder,
            )
            for step in request.reads
        )

        review = independent_reviewer(findings)
        if not isinstance(review, bool):
            raise ShadowWorkflowError("INVALID_INDEPENDENT_REVIEW_RESULT")

        plan = self.workflow.propose(
            findings=list(findings),
            action=request.action,
            target=request.target,
            expected_effect=request.expected_effect,
            independent_review_confirmed=review,
            risk=request.risk,
        )

        if self.workflow.capabilities_issued != 0 or self.workflow.external_writes_performed != 0:
            raise ShadowWorkflowError("SHADOW_INVARIANT_BROKEN")

        return ShadowTaskResult(
            request_id="REQ-" + uuid.uuid4().hex[:16].upper(),
            findings=findings,
            plan=plan,
            independent_review_confirmed=True,
            capabilities_issued=0,
            external_writes_performed=0,
        )
