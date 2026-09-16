from __future__ import annotations

from urllib.request import HTTPRedirectHandler, Request, build_opener

from alpha_orchestrator.read_plane import ReadTransportError


class FailClosedRedirectHandler(HTTPRedirectHandler):
    """Reject every HTTP redirect before a credentialed follow-up request can be built."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ReadTransportError("HTTP_REDIRECT_DENIED") from None


def fail_closed_urlopen(request: Request, *, timeout: float):
    """Open one request with redirects disabled fail-closed."""

    opener = build_opener(FailClosedRedirectHandler())
    return opener.open(request, timeout=timeout)
