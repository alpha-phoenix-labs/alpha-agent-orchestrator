from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .operations_gateway_http import DevelopmentOperatorBearerAuthorizer, JSON_CONTENT_TYPE
from .operations_read import OperationsReadUnauthorized
from .sandbox_write import SandboxApprovalRequest, SandboxPipeline
from .view_contracts import view_payload


SANDBOX_CONTROL_STATE_PATH = "/v1/sandbox-control/state"
SANDBOX_CONTROL_APPROVE_PATH = "/v1/sandbox-control/approve"
SANDBOX_CONTROL_EXECUTE_PATH = "/v1/sandbox-control/execute"
SANDBOX_CONTROL_SCHEMA_VERSION = 1
MAX_CONTROL_BODY_BYTES = 16 * 1024


@dataclass(frozen=True)
class SandboxControlResponse:
    status: int
    headers: tuple[tuple[str, str], ...]
    body: bytes


def _headers(*, allow: str | None = None) -> tuple[tuple[str, str], ...]:
    values = [
        ("Content-Type", JSON_CONTENT_TYPE),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
    ]
    if allow is not None:
        values.append(("Allow", allow))
    return tuple(values)


def _json_response(status: int, payload: dict[str, object], *, allow: str | None = None) -> SandboxControlResponse:
    return SandboxControlResponse(
        status=status,
        headers=_headers(allow=allow),
        body=json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"),
    )


class SandboxControlHttpAdapter:
    """Development-only Human Gate and execution adapter for one isolated sandbox pipeline.

    This adapter owns no provider credential and cannot target GitHub, Render or production.
    It only delegates to a preconfigured SandboxPipeline whose target registry constrains the
    physical repository beneath the configured local sandbox root.
    """

    __slots__ = ("_pipeline", "_order_id", "_authorizer")

    def __init__(
        self,
        *,
        pipeline: SandboxPipeline,
        order_id: str,
        authorizer: DevelopmentOperatorBearerAuthorizer,
    ) -> None:
        if order_id not in pipeline.orders:
            raise ValueError("SANDBOX_CONTROL_ORDER_REQUIRED")
        self._pipeline = pipeline
        self._order_id = order_id
        self._authorizer = authorizer

    def _authorize(self, authorization: str | None) -> bool:
        try:
            self._authorizer.authorize(authorization)
            return True
        except OperationsReadUnauthorized:
            return False

    def _state(self) -> SandboxControlResponse:
        contracts = self._pipeline.control_contracts(self._order_id)
        return _json_response(
            200,
            {
                "schema_version": SANDBOX_CONTROL_SCHEMA_VERSION,
                "order_id": self._order_id,
                "contracts": [view_payload(contract) for contract in contracts],
            },
        )

    @staticmethod
    def _parse_body(body: bytes) -> dict[str, Any] | None:
        if len(body) > MAX_CONTROL_BODY_BYTES:
            return None
        try:
            value = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not isinstance(value, dict):
            return None
        return value

    def _binding_matches(self, body: dict[str, Any], request: SandboxApprovalRequest) -> bool:
        return (
            body.get("order_id") == request.order_id
            and body.get("action") == request.action
            and body.get("target") == request.target
            and body.get("base_sha") == request.base_sha
            and body.get("base_state_version") == request.base_state_version
            and body.get("plan_hash") == request.plan_hash
            and body.get("risk") == request.risk
        )

    def _approve(self, body: bytes) -> SandboxControlResponse:
        payload = self._parse_body(body)
        if payload is None:
            return _json_response(400, {"error": "INVALID_REQUEST_BODY"})

        request = self._pipeline.requests[self._order_id]
        if not self._binding_matches(payload, request):
            return _json_response(409, {"error": "APPROVAL_BINDING_MISMATCH"})
        if payload.get("confirmation") != f"APPROVE {request.order_id}":
            return _json_response(400, {"error": "EXACT_APPROVAL_CONFIRMATION_REQUIRED"})

        try:
            approval_id = self._pipeline.human_approve(request, approved_by="USER_ONLY")
        except PermissionError:
            return _json_response(409, {"error": "APPROVAL_REJECTED"})

        state = json.loads(self._state().body)
        state["approval_id"] = approval_id
        return _json_response(200, state)

    def _execute(self, body: bytes) -> SandboxControlResponse:
        payload = self._parse_body(body)
        if payload is None:
            return _json_response(400, {"error": "INVALID_REQUEST_BODY"})
        if payload.get("order_id") != self._order_id:
            return _json_response(409, {"error": "EXECUTION_ORDER_MISMATCH"})
        if payload.get("confirmation") != f"EXECUTE {self._order_id}":
            return _json_response(400, {"error": "EXACT_EXECUTION_CONFIRMATION_REQUIRED"})
        approval_id = payload.get("approval_id")
        if not isinstance(approval_id, str) or not approval_id:
            return _json_response(400, {"error": "APPROVAL_ID_REQUIRED"})

        try:
            result = self._pipeline.execute(
                order_id=self._order_id,
                approval_id=approval_id,
                writer_role="code_writer",
            )
        except PermissionError:
            return _json_response(409, {"error": "EXECUTION_REJECTED"})

        state = json.loads(self._state().body)
        state["execution_result"] = {
            "execution_id": result.execution_id,
            "success": result.success,
            "detail": result.detail,
        }
        return _json_response(200 if result.success else 409, state)

    def handle(
        self,
        *,
        method: str,
        path: str,
        authorization: str | None,
        body: bytes = b"",
    ) -> SandboxControlResponse:
        if not self._authorize(authorization):
            return SandboxControlResponse(status=401, headers=_headers(), body=b"")

        if path == SANDBOX_CONTROL_STATE_PATH:
            if method != "GET":
                return _json_response(405, {"error": "METHOD_NOT_ALLOWED"}, allow="GET")
            return self._state()

        if path == SANDBOX_CONTROL_APPROVE_PATH:
            if method != "POST":
                return _json_response(405, {"error": "METHOD_NOT_ALLOWED"}, allow="POST")
            return self._approve(body)

        if path == SANDBOX_CONTROL_EXECUTE_PATH:
            if method != "POST":
                return _json_response(405, {"error": "METHOD_NOT_ALLOWED"}, allow="POST")
            return self._execute(body)

        return _json_response(404, {"error": "NOT_FOUND"})
