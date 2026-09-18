from __future__ import annotations

import argparse
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from alpha_orchestrator.sandbox_control_http import MAX_CONTROL_BODY_BYTES
from alpha_orchestrator.sandbox_control_preview import (
    PHASE5_PREVIEW_TOKEN_ENV,
    build_phase5_sandbox_control_preview,
)


HEALTH_PATH = "/healthz"


def _handler(runtime):
    class Handler(BaseHTTPRequestHandler):
        server_version = "ALPHAPhase5SandboxControl/1"

        def log_message(self, format: str, *args: object) -> None:
            return

        def _send(self, method: str) -> None:
            if method == "GET" and self.path == HEALTH_PATH:
                body = b'{"ok":true,"mode":"SANDBOX_WRITE","target":"isolated-local-git","production_write":false}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            raw_length = self.headers.get("Content-Length", "0")
            try:
                content_length = int(raw_length)
            except ValueError:
                content_length = MAX_CONTROL_BODY_BYTES + 1

            if content_length < 0 or content_length > MAX_CONTROL_BODY_BYTES:
                body = b'{"error":"REQUEST_BODY_TOO_LARGE"}'
                self.send_response(413)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            request_body = self.rfile.read(content_length) if content_length else b""
            response = runtime.adapter.handle(
                method=method,
                path=self.path,
                authorization=self.headers.get("Authorization"),
                body=request_body,
            )
            self.send_response(response.status)
            for name, value in response.headers:
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(response.body)))
            self.end_headers()
            if response.body:
                self.wfile.write(response.body)

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
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "10001")))
    args = parser.parse_args()

    token = os.environ.get(PHASE5_PREVIEW_TOKEN_ENV)
    if not token:
        raise SystemExit(f"{PHASE5_PREVIEW_TOKEN_ENV} is required")

    runtime = build_phase5_sandbox_control_preview(token=token)
    server = ThreadingHTTPServer((args.host, args.port), _handler(runtime))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        runtime.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
