from __future__ import annotations

import argparse
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from alpha_orchestrator.live_events import LiveEventCursor, parse_live_event
from alpha_orchestrator.models import SystemMode
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
from alpha_orchestrator.view_contracts import system_state_view


TOKEN_ENV = "ALPHA_E2E_OPERATIONS_PREVIEW_TOKEN"
HEALTH_PATH = "/healthz"


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


class OperationsE2EScenario:
    """Deterministic read-only runtime sequence for browser transport proof."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._snapshot_reads = 0
        self._event_reads = 0

    def snapshot_provider(self):
        with self._lock:
            self._snapshot_reads += 1
            read_number = self._snapshot_reads

        if read_number == 1:
            version, sequence = "state-v1", 0
        elif read_number == 2:
            version, sequence = "state-v2", 1
        elif read_number == 3:
            version, sequence = "state-v3", 3
        else:
            raise OperationsReadSnapshotError("E2E_AUTHORITY_UNAVAILABLE")

        return (
            (_system_state(version),),
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
            return (_event(sequence=1, base="state-v1", version="state-v2"),)
        if read_number == 2:
            return (_event(sequence=3, base="state-v2", version="state-v3"),)
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

    scenario = OperationsE2EScenario()
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
