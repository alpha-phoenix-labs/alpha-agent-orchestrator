from __future__ import annotations

from email.message import Message
from io import BytesIO
from urllib.request import BaseHandler, HTTPErrorProcessor, OpenerDirector, Request
from urllib.response import addinfourl

import pytest

from alpha_orchestrator.connectors.github_http_transport import GitHubReadTransport
from alpha_orchestrator.connectors.http_safety import FailClosedRedirectHandler, fail_closed_urlopen
from alpha_orchestrator.connectors.render_http_transport import RenderReadTransport
from alpha_orchestrator.read_plane import ReadTransportError


class RedirectingHTTPHandler(BaseHandler):
    def __init__(self, *, status: int) -> None:
        self.status = status
        self.requests: list[Request] = []

    def http_open(self, request: Request):
        self.requests.append(request)
        headers = Message()
        headers["Location"] = "http://redirected.invalid/target"
        response = addinfourl(BytesIO(b""), headers, request.full_url, code=self.status)
        response.msg = "Redirect"
        return response


@pytest.mark.parametrize("transport_cls", [GitHubReadTransport, RenderReadTransport])
def test_credentialed_transports_default_to_fail_closed_redirect_opener(transport_cls):
    transport = transport_cls(token="TEST-READ-CREDENTIAL")
    assert transport._opener is fail_closed_urlopen


@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
def test_redirect_handler_denies_before_second_dispatch_and_sanitizes_error(status: int):
    token = "TEST-SECRET-REDIRECT-CREDENTIAL"
    http_handler = RedirectingHTTPHandler(status=status)
    opener = OpenerDirector()
    opener.add_handler(http_handler)
    opener.add_handler(FailClosedRedirectHandler())
    opener.add_handler(HTTPErrorProcessor())

    request = Request(
        "http://validated.invalid/start",
        method="GET",
        headers={"Authorization": f"Bearer {token}"},
    )

    with pytest.raises(ReadTransportError, match="HTTP_REDIRECT_DENIED") as exc_info:
        opener.open(request, timeout=1.0)

    assert len(http_handler.requests) == 1
    assert http_handler.requests[0].full_url == "http://validated.invalid/start"
    assert http_handler.requests[0].get_header("Authorization") == f"Bearer {token}"
    assert token not in str(exc_info.value)
