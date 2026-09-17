from __future__ import annotations

from collections.abc import Iterable

from .live_events import LiveEventCursor, LiveEventEnvelope
from .models import SystemMode
from .operations_gateway_http import (
    DevelopmentOperatorBearerAuthorizer,
    OperationsGatewayHttpAdapter,
)
from .operations_read import OperationsReadBoundary
from .orchestrator import OrchestratorCore
from .view_contracts import (
    ViewContract,
    agent_view_unavailable,
    canonical_state_view,
    connector_view_unavailable,
    runtime_view_unavailable,
    system_state_view,
    telemetry_view_unavailable,
)

PREVIEW_TOKEN_ENV = "ALPHA_OPERATIONS_PREVIEW_TOKEN"


class OperationsPreviewRuntime:
    """Development/preview read-only runtime backed by the real control-plane core.

    Phase 4 intentionally exposes no mutation route and does not synthesize
    operational events. Data that is not yet wired to an authoritative source
    is represented explicitly as unavailable.
    """

    def __init__(self) -> None:
        self._core = OrchestratorCore(mode=SystemMode.SHADOW, writes_enabled=False)

    def snapshot_provider(self) -> tuple[Iterable[ViewContract], LiveEventCursor]:
        snapshot = self._core.state.snapshot()
        contracts = (
            system_state_view(
                mode=self._core.mode,
                writes_enabled=self._core.writes_enabled,
                snapshot=snapshot,
            ),
            canonical_state_view(unavailable_reason="PREVIEW_CANONICAL_STATE_NOT_WIRED"),
            agent_view_unavailable("PREVIEW_AGENT_RUNTIME_NOT_WIRED"),
            connector_view_unavailable("PREVIEW_CONNECTOR_RUNTIME_NOT_WIRED"),
            runtime_view_unavailable("PREVIEW_RUNTIME_TELEMETRY_NOT_WIRED"),
            telemetry_view_unavailable("PREVIEW_TELEMETRY_NOT_WIRED"),
        )
        cursor = LiveEventCursor(
            last_sequence=0,
            current_state_version=snapshot.version,
        )
        return contracts, cursor

    def event_provider(self) -> Iterable[LiveEventEnvelope]:
        return ()


def build_operations_preview_adapter(*, token: str) -> OperationsGatewayHttpAdapter:
    runtime = OperationsPreviewRuntime()
    boundary = OperationsReadBoundary(
        authorizer=DevelopmentOperatorBearerAuthorizer(expected_token=token)
    )
    return OperationsGatewayHttpAdapter(
        boundary=boundary,
        snapshot_provider=runtime.snapshot_provider,
        event_provider=runtime.event_provider,
    )
