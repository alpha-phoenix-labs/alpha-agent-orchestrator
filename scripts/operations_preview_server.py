from __future__ import annotations

import argparse
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from alpha_orchestrator.operations_gateway_http import (
    OperationsGatewayResponse,
    OperationsGatewayStreamResponse,
)
from alpha_orchestrator.operations_preview import (
    PREVIEW_TOKEN_ENV,
    build_operations_preview_adapter,
)

HEALTH_PATH = "/healthz"


def _handler(adapter):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ALPHAOperationsPreview/1"

        def log_message(self, format: str, *args: object) -> None:
            return

        def _send(self, method: str) -> None:
            if method == "GET" and self.path == HEALTH_PATH:
                body = b'{"ok":true,"mode":"OPERATIONS_PREVIEW","writes_enabled":false}'
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
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "10000")))
    args = parser.parse_args()

    token = os.environ.get(PREVIEW_TOKEN_ENV)
    if not token:
        raise SystemExit(f"{PREVIEW_TOKEN_ENV} is required")

    adapter = build_operations_preview_adapter(token=token)
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
