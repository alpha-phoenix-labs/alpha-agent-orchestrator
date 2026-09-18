from __future__ import annotations

import argparse
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from alpha_orchestrator.connectors.github_http_transport import GitHubReadTransport
from alpha_orchestrator.live_events import LiveEventCursor, parse_live_event
from alpha_orchestrator.models import SystemMode
from alpha_orchestrator.read_plane import ReadBroker, ReadSourcePolicy
from alpha_orchestrator.shadow_read import ShadowReadService
from alpha_orchestrator.shadow_task import ShadowReadStep, ShadowTaskRequest, ShadowTaskRunner
from alpha_orchestrator.operations_gateway_http import (
    DevelopmentOperatorBearerAuthorizer,
    OperationsGatewayHttpAdapter,
    OperationsGatewayResponse,
    OperationsGatewayStreamResponse,
)
from alpha_orchestrator.operations_read import (
    OperationsReadBoundary,
    OperationsReadSnapshotError,
)
from alpha_orchestrator.state import StateSnapshot
from alpha_orchestrator.view_contracts import (
    evidence_view,
    finding_view,
    lifecycle_view,
    plan_view,
    system_state_view,
    work_order_view,
    writer_view,
)


TOKEN_ENV = "ALPHA_E2E_OPERATIONS_PREVIEW_TOKEN"
HEALTH_PATH = "/healthz"
GITHUB_REPOSITORY_URL = "https://api.github.com/repos/alpha-phoenix-labs/alpha-agent-orchestrator"


def _system_state(version: str):
    return system_state_view(
        mode=SystemMode.SHADOW,
        writes_enabled=False,
        snapshot=StateSnapshot(version=version, data={}),
    )


def _event(*, sequence: int, base: str, version: str):
    return parse_live_event(
        {
            "schema_version": 1,
            "event_id": f"e2e-event-{sequence}",
            "sequence": sequence,
            "base_state_version": base,
            "state_version": version,
            "emitted_at": "2026-09-17T20:30:00+00:00",
            "event_type": "VIEW_CONTRACT_SYSTEM_STATE",
            "payload": {
                "contract": "SYSTEM_STATE",
                "source_class": "AUTHORITATIVE",
                "mode": "SHADOW",
                "writes_enabled": False,
                "state_version": version,
            },
        }
    )


def _real_shadow_contracts():
    transport = GitHubReadTransport.from_env()
    broker = ReadBroker(
        policies={
            "github": ReadSourcePolicy(
                source_id="github",
                allowed_hosts=("api.github.com",),
                allowed_path_prefixes=("/repos/alpha-phoenix-labs/alpha-agent-orchestrator",),
            )
        },
        transport=transport,
    )
    runner = ShadowTaskRunner(read_service=ShadowReadService(broker))
    result = runner.run(
        request=ShadowTaskRequest(
            reads=(
                ShadowReadStep(
                    reader_id="github_branch_reader",
                    source_id="github",
                    url=GITHUB_REPOSITORY_URL,
                    claim_builder=lambda payload: (
                        f"default_branch={payload.get('default_branch', 'UNKNOWN')}"
                    ),
                ),
            ),
            action="git_commit",
            target="repo://alpha-phoenix-labs/alpha-agent-orchestrator/docs/phase4-shadow-observation",
            expected_effect="proposal only; no write execution",
        ),
        independent_reviewer=lambda findings: bool(findings)
        and all(
            finding.provenance.get("verification_state") == "READ_VALIDATED"
            and finding.provenance.get("freshness_result") == "FRESH"
            for finding in findings
        ),
    )
    if result.capabilities_issued != 0 or result.external_writes_performed != 0:
        raise RuntimeError("REAL_SHADOW_E2E_WRITE_INVARIANT_BROKEN")

    contracts = [
        work_order_view(result.order),
        lifecycle_view(result.order),
        plan_view(result.plan),
        writer_view(result.plan),
    ]
    for finding in result.findings:
        contracts.append(finding_view(finding))
        contracts.append(
            evidence_view(
                finding.evidence,
                verification_state=str(finding.provenance["verification_state"]),
            )
        )
    return tuple(contracts), result.order.base_state_version


class OperationsE2EScenario:
    """Real Shadow snapshot plus deterministic read-only resilience sequence."""

    def __init__(self, *, shadow_contracts, initial_state_version: str) -> None:
        self._lock = threading.Lock()
        self._snapshot_reads = 0
        self._event_reads = 0
        self._shadow_contracts = tuple(shadow_contracts)
        self._initial_state_version = initial_state_version

    def snapshot_provider(self):
        with self._lock:
            self._snapshot_reads += 1
            read_number = self._snapshot_reads

        if read_number == 1:
            version, sequence = self._initial_state_version, 0
        elif read_number == 2:
            version, sequence = "state-resynced-v2", 1
        elif read_number == 3:
            version, sequence = "state-resynced-v3", 3
        else:
            raise OperationsReadSnapshotError("E2E_AUTHORITY_UNAVAILABLE")

        return (
            (_system_state(version), *self._shadow_contracts),
            LiveEventCursor(
                last_sequence=sequence,
                current_state_version=version,
            ),
        )

    def event_provider(self):
        with self._lock:
            self._event_reads += 1
            read_number = self._event_reads

        if read_number == 1:
            def first_stream():
                yield _event(
                    sequence=1,
                    base=self._initial_state_version,
                    version="state-resynced-v2",
                )
                time.sleep(3)
            return first_stream()
        if read_number == 2:
            return (
                _event(
                    sequence=3,
                    base="state-resynced-v2",
                    version="state-resynced-v3",
                ),
            )
        return ()


def _build_adapter(token: str, scenario: OperationsE2EScenario) -> OperationsGatewayHttpAdapter:
    boundary = OperationsReadBoundary(
        authorizer=DevelopmentOperatorBearerAuthorizer(expected_token=token)
    )
    return OperationsGatewayHttpAdapter(
        boundary=boundary,
        snapshot_provider=scenario.snapshot_provider,
        event_provider=scenario.event_provider,
    )


def _handler(adapter: OperationsGatewayHttpAdapter):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ALPHAOperationsE2E/1"

        def log_message(self, format: str, *args: object) -> None:
            return

        def _send(self, method: str) -> None:
            if method == "GET" and self.path == HEALTH_PATH:
                body = b'{"ok":true,"mode":"OPERATIONS_E2E"}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            response = adapter.handle(
                method=method,
                path=self.path,
                authorization=self.headers.get("Authorization"),
            )
            self.send_response(response.status)
            for name, value in response.headers:
                self.send_header(name, value)

            if isinstance(response, OperationsGatewayResponse):
                self.send_header("Content-Length", str(len(response.body)))
                self.end_headers()
                if response.body:
                    self.wfile.write(response.body)
                return

            if not isinstance(response, OperationsGatewayStreamResponse):
                raise RuntimeError("UNEXPECTED_GATEWAY_RESPONSE")

            self.send_header("Connection", "close")
            self.end_headers()
            try:
                for chunk in response.body:
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                self.close_connection = True

        def do_GET(self) -> None:
            self._send("GET")

        def do_POST(self) -> None:
            self._send("POST")

        def do_PUT(self) -> None:
            self._send("PUT")

        def do_PATCH(self) -> None:
            self._send("PATCH")

        def do_DELETE(self) -> None:
            self._send("DELETE")

    return Handler


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4180)
    args = parser.parse_args()

    token = os.environ.get(TOKEN_ENV)
    if not token:
        raise SystemExit(f"{TOKEN_ENV} is required")

    shadow_contracts, initial_state_version = _real_shadow_contracts()
    scenario = OperationsE2EScenario(
        shadow_contracts=shadow_contracts,
        initial_state_version=initial_state_version,
    )
    adapter = _build_adapter(token, scenario)
    server = ThreadingHTTPServer((args.host, args.port), _handler(adapter))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
