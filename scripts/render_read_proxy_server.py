from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from alpha_orchestrator.render_read_proxy import (
    RenderReadProxy,
    RenderReadProxyError,
    RenderReadProxyUnauthorized,
)


proxy = RenderReadProxy.from_env()


class Handler(BaseHTTPRequestHandler):
    server_version = "AlphaRenderReadProxy/0.1"

    def _write(self, status: int, body: bytes, *, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._write(200, b'{"ok":true,"mode":"READ_ONLY_PROXY"}')
            return
        if self.path != "/v1/render/services":
            self._write(404, b'{"error":"NOT_FOUND"}')
            return
        try:
            body = proxy.services(authorization=self.headers.get("Authorization"))
        except RenderReadProxyUnauthorized:
            self._write(401, b'{"error":"UNAUTHORIZED"}')
            return
        except RenderReadProxyError:
            self._write(502, b'{"error":"UPSTREAM_READ_FAILED"}')
            return
        self._write(200, body)

    def _method_not_allowed(self) -> None:
        body = b'{"error":"METHOD_NOT_ALLOWED"}'
        self.send_response(405)
        self.send_header("Allow", "GET")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    do_POST = _method_not_allowed
    do_PUT = _method_not_allowed
    do_PATCH = _method_not_allowed
    do_DELETE = _method_not_allowed

    def log_message(self, format: str, *args) -> None:
        # Avoid default request logging at this credential boundary.
        return


port = int(os.environ.get("PORT", "10000"))
server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
server.serve_forever()
