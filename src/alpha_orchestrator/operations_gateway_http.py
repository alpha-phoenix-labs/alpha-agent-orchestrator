from __future__ import annotations

import hmac
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from .live_events import LiveEventCursor, LiveEventEnvelope
from .live_sse import SSE_CONTENT_TYPE
from .operations_read import (
    OperationsReadBoundary,
    OperationsReadSnapshotError,
    OperationsReadUnauthorized,
)
from .view_contracts import ViewContract


OPERATIONS_SNAPSHOT_PATH = "/v1/operations/snapshot"
OPERATIONS_EVENTS_PATH = "/v1/operations/events"
DEVELOPMENT_OPERATOR_PRINCIPAL = "DEVELOPMENT_OPERATOR"
JSON_CONTENT_TYPE = "application/json; charset=utf-8"


@dataclass(frozen=True)
class OperationsGatewayResponse:
    status: int
    headers: tuple[tuple[str, str], ...]
    body: bytes


@dataclass(frozen=True)
class OperationsGatewayStreamResponse:
    status: int
    headers: tuple[tuple[str, str], ...]
    body: Iterable[bytes]


GatewayResponse = OperationsGatewayResponse | OperationsGatewayStreamResponse
SnapshotProvider = Callable[[], tuple[Iterable[ViewContract], LiveEventCursor]]
EventProvider = Callable[[], Iterable[LiveEventEnvelope]]


class DevelopmentOperatorBearerAuthorizer:
    """Preview-only opaque bearer authorization with redacted representation."""

    __slots__ = ("_expected_token",)

    def __init__(self, *, expected_token: str) -> None:
        if (
            not isinstance(expected_token, str)
            or not expected_token
            or "\r" in expected_token
            or "\n" in expected_token
        ):
            raise ValueError("INVALID_DEVELOPMENT_OPERATOR_TOKEN")
        self._expected_token = expected_token

    def __repr__(self) -> str:
        return (
            "DevelopmentOperatorBearerAuthorizer("
            "principal=DEVELOPMENT_OPERATOR, expected_token=<redacted>)"
        )

    def authorize(self, auth_context: object | None) -> None:
        if not isinstance(auth_context, str):
            raise OperationsReadUnauthorized("OPERATIONS_READ_UNAUTHORIZED")

        prefix = "Bearer "
        if not auth_context.startswith(prefix):
            raise OperationsReadUnauthorized("OPERATIONS_READ_UNAUTHORIZED")

        presented = auth_context[len(prefix) :]
        if (
            not presented
            or "\r" in presented
            or "\n" in presented
            or not hmac.compare_digest(presented, self._expected_token)
        ):
            raise OperationsReadUnauthorized("OPERATIONS_READ_UNAUTHORIZED")


def _headers(content_type: str, *, allow: str | None = None) -> tuple[tuple[str, str], ...]:
    values = [
        ("Content-Type", content_type),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
    ]
    if allow is not None:
        values.append(("Allow", allow))
    return tuple(values)


class OperationsGatewayHttpAdapter:
    """Transport adapter for preview snapshot + SSE reads only.

    The adapter does not bind a port, configure CORS, read secrets from the
    environment, own provider credentials, or expose any mutation route.
    """

    __slots__ = ("_boundary", "_snapshot_provider", "_event_provider")

    def __init__(
        self,
        *,
        boundary: OperationsReadBoundary,
        snapshot_provider: SnapshotProvider,
        event_provider: EventProvider,
    ) -> None:
        self._boundary = boundary
        self._snapshot_provider = snapshot_provider
        self._event_provider = event_provider

    def handle(
        self,
        *,
        method: str,
        path: str,
        authorization: str | None,
    ) -> GatewayResponse:
        if method != "GET":
            return OperationsGatewayResponse(
                status=405,
                headers=_headers(JSON_CONTENT_TYPE, allow="GET"),
                body=b'{"error":"METHOD_NOT_ALLOWED"}',
            )

        if path == OPERATIONS_SNAPSHOT_PATH:
            return self._snapshot(authorization=authorization)
        if path == OPERATIONS_EVENTS_PATH:
            return self._events(authorization=authorization)

        return OperationsGatewayResponse(
            status=404,
            headers=_headers(JSON_CONTENT_TYPE),
            body=b'{"error":"NOT_FOUND"}',
        )

    def _snapshot(self, *, authorization: str | None) -> OperationsGatewayResponse:
        try:
            self._boundary.authorize(auth_context=authorization)
            contracts, live_cursor = self._snapshot_provider()
            body = self._boundary.snapshot(
                auth_context=authorization,
                contracts=contracts,
                live_cursor=live_cursor,
            )
        except OperationsReadUnauthorized:
            return OperationsGatewayResponse(
                status=401,
                headers=_headers(JSON_CONTENT_TYPE),
                body=b"",
            )
        except OperationsReadSnapshotError:
            return OperationsGatewayResponse(
                status=503,
                headers=_headers(JSON_CONTENT_TYPE),
                body=b'{"error":"AUTHORITY_UNAVAILABLE"}',
            )

        return OperationsGatewayResponse(
            status=200,
            headers=_headers(JSON_CONTENT_TYPE),
            body=body,
        )

    def _events(self, *, authorization: str | None) -> GatewayResponse:
        try:
            self._boundary.authorize(auth_context=authorization)
            events = self._event_provider()
            body = self._boundary.sse_stream(
                auth_context=authorization,
                events=events,
            )
        except OperationsReadUnauthorized:
            return OperationsGatewayResponse(
                status=401,
                headers=_headers(JSON_CONTENT_TYPE),
                body=b"",
            )

        return OperationsGatewayStreamResponse(
            status=200,
            headers=_headers(SSE_CONTENT_TYPE),
            body=body,
        )
