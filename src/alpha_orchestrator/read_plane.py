from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Callable, Mapping, Protocol
from urllib.parse import urlparse
import uuid


class ReadPlaneError(RuntimeError):
    pass


class ReadPolicyDenied(ReadPlaneError):
    pass


class ReadTransportError(ReadPlaneError):
    pass


@dataclass(frozen=True)
class ReadSourcePolicy:
    source_id: str
    allowed_hosts: tuple[str, ...]
    allowed_path_prefixes: tuple[str, ...]
    max_response_bytes: int = 1_000_000
    timeout_seconds: float = 8.0

    def validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "https":
            raise ReadPolicyDenied("HTTPS_REQUIRED")
        host = (parsed.hostname or "").lower()
        if host not in {h.lower() for h in self.allowed_hosts}:
            raise ReadPolicyDenied("HOST_NOT_ALLOWLISTED")
        if not any(parsed.path.startswith(prefix) for prefix in self.allowed_path_prefixes):
            raise ReadPolicyDenied("PATH_NOT_ALLOWLISTED")
        if parsed.username or parsed.password:
            raise ReadPolicyDenied("CREDENTIALS_IN_URL_FORBIDDEN")


@dataclass(frozen=True)
class TransportResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


class ReadTransport(Protocol):
    def __call__(self, *, url: str, headers: Mapping[str, str], timeout: float) -> TransportResponse: ...


@dataclass(frozen=True)
class ReadObservation:
    observation_id: str
    source_id: str
    url: str
    status: int
    observed_at: str
    content_type: str
    body_digest: str
    body_size: int
    parsed_payload: object

    def evidence_payload(self) -> dict:
        return {
            "observation_id": self.observation_id,
            "source_id": self.source_id,
            "url": self.url,
            "status": self.status,
            "observed_at": self.observed_at,
            "content_type": self.content_type,
            "body_digest": self.body_digest,
            "body_size": self.body_size,
        }


class ReadBroker:
    """Deterministic read-only broker.

    The broker intentionally has no generic HTTP method parameter. Every request is a GET
    implemented by the injected transport. Agents receive observations, never credentials.
    """

    SENSITIVE_HEADERS = {"authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"}

    def __init__(self, *, policies: Mapping[str, ReadSourcePolicy], transport: ReadTransport) -> None:
        self._policies = dict(policies)
        self._transport = transport

    @staticmethod
    def _safe_headers(headers: Mapping[str, str] | None) -> dict[str, str]:
        return dict(headers or {})

    def fetch_json(self, *, source_id: str, url: str, headers: Mapping[str, str] | None = None) -> ReadObservation:
        policy = self._policies.get(source_id)
        if not policy:
            raise ReadPolicyDenied("UNKNOWN_SOURCE")
        policy.validate_url(url)
        request_headers = self._safe_headers(headers)
        try:
            response = self._transport(url=url, headers=request_headers, timeout=policy.timeout_seconds)
        except ReadPlaneError:
            raise
        except Exception as exc:
            raise ReadTransportError("READ_TRANSPORT_FAILED") from exc

        if response.status < 200 or response.status >= 300:
            raise ReadTransportError(f"NON_SUCCESS_STATUS:{response.status}")
        if len(response.body) > policy.max_response_bytes:
            raise ReadTransportError("RESPONSE_TOO_LARGE")

        content_type = next((v for k, v in response.headers.items() if k.lower() == "content-type"), "")
        if "json" not in content_type.lower():
            raise ReadTransportError("JSON_CONTENT_TYPE_REQUIRED")
        try:
            payload = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ReadTransportError("INVALID_JSON_RESPONSE") from exc

        observed_at = datetime.now(timezone.utc).isoformat()
        return ReadObservation(
            observation_id="OBS-" + uuid.uuid4().hex[:16].upper(),
            source_id=source_id,
            url=url,
            status=response.status,
            observed_at=observed_at,
            content_type=content_type,
            body_digest=sha256(response.body).hexdigest(),
            body_size=len(response.body),
            parsed_payload=payload,
        )
