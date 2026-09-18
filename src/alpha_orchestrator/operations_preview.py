from __future__ import annotations

import threading
from collections.abc import Iterable

from .live_event_producer import LiveEventProducer
from .live_events import LiveEventCursor, LiveEventEnvelope
from .models import SystemMode
from .operations_gateway_http import (
    DevelopmentOperatorBearerAuthorizer,
    OperationsGatewayHttpAdapter,
)
from .operations_read import OperationsReadBoundary, OperationsReadSnapshotError
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

    Phase 4 intentionally exposes no mutation route. The live stream emits the
    authoritative SYSTEM_STATE contract through the repository-owned live-event
    producer once per runtime, then remains quiet until a later authoritative
    state-change source is wired. Unavailable domains remain explicit.
    """

    def __init__(self) -> None:
        self._core = OrchestratorCore(mode=SystemMode.SHADOW, writes_enabled=False)
        initial = self._core.state.snapshot()
        self._producer = LiveEventProducer(
            last_sequence=0,
            current_state_version=initial.version,
        )
        self._initial_system_state_emitted = False
        self._lock = threading.Lock()

    def _system_contract(self, snapshot) -> ViewContract:
        return system_state_view(
            mode=self._core.mode,
            writes_enabled=self._core.writes_enabled,
            snapshot=snapshot,
        )

    def snapshot_provider(self) -> tuple[Iterable[ViewContract], LiveEventCursor]:
        with self._lock:
            snapshot = self._core.state.snapshot()
            cursor = self._producer.cursor
            if cursor.current_state_version != snapshot.version:
                raise OperationsReadSnapshotError("PREVIEW_LIVE_CURSOR_STATE_MISMATCH")

            contracts = (
                self._system_contract(snapshot),
                canonical_state_view(unavailable_reason="PREVIEW_CANONICAL_STATE_NOT_WIRED"),
                agent_view_unavailable("PREVIEW_AGENT_RUNTIME_NOT_WIRED"),
                connector_view_unavailable("PREVIEW_CONNECTOR_RUNTIME_NOT_WIRED"),
                runtime_view_unavailable("PREVIEW_RUNTIME_TELEMETRY_NOT_WIRED"),
                telemetry_view_unavailable("PREVIEW_TELEMETRY_NOT_WIRED"),
            )
            return contracts, cursor

    def event_provider(self) -> Iterable[LiveEventEnvelope]:
        with self._lock:
            if self._initial_system_state_emitted:
                return ()

            snapshot = self._core.state.snapshot()
            if self._producer.cursor.current_state_version != snapshot.version:
                raise OperationsReadSnapshotError("PREVIEW_LIVE_CURSOR_STATE_MISMATCH")

            event = self._producer.emit_system_state(self._system_contract(snapshot))
            self._initial_system_state_emitted = True
            return (event,)


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
