from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
import math
from typing import Mapping, Protocol
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

    @staticmethod
    def _matches_prefix(path: str, prefix: str) -> bool:
        normalized = prefix.rstrip("/") or "/"
        if normalized == "/":
            return path.startswith("/")
        return path == normalized or path.startswith(normalized + "/")

    def validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "https":
            raise ReadPolicyDenied("HTTPS_REQUIRED")
        host = (parsed.hostname or "").lower()
        if host not in {h.lower() for h in self.allowed_hosts}:
            raise ReadPolicyDenied("HOST_NOT_ALLOWLISTED")
        if not any(self._matches_prefix(parsed.path, prefix) for prefix in self.allowed_path_prefixes):
            raise ReadPolicyDenied("PATH_NOT_ALLOWLISTED")
        if parsed.username or parsed.password:
            raise ReadPolicyDenied("CREDENTIALS_IN_URL_FORBIDDEN")


@dataclass(frozen=True)
class TransportResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


class ReadTransport(Protocol):
    """Backend-only GET transport. Authentication is owned here, never by the agent caller."""

    def __call__(self, *, url: str, timeout: float) -> TransportResponse: ...


def _transport_provenance_id(transport: ReadTransport) -> str:
    module = getattr(transport, "__module__", None)
    qualname = getattr(transport, "__qualname__", None)
    if module and qualname:
        return f"{module}.{qualname}"
    transport_type = type(transport)
    return f"{transport_type.__module__}.{transport_type.__qualname__}"


def _canonical_target_id(*, source_id: str, url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    target = f"{host}{parsed.path}"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    return f"{source_id}:{target}"


def require_fresh_timestamp(
    *,
    observed_at: str,
    max_age_seconds: float,
    now: datetime | None = None,
) -> None:
    """Fail closed when a provenance timestamp is stale, invalid, ambiguous or future-dated."""
    if (
        not isinstance(max_age_seconds, (int, float))
        or isinstance(max_age_seconds, bool)
        or not math.isfinite(float(max_age_seconds))
        or max_age_seconds <= 0
    ):
        raise ValueError("max_age_seconds must be a positive finite number")
    try:
        observed = datetime.fromisoformat(observed_at)
    except (TypeError, ValueError) as exc:
        raise ReadPolicyDenied("INVALID_OBSERVATION_TIME") from exc
    if observed.tzinfo is None:
        raise ReadPolicyDenied("OBSERVATION_TIMEZONE_REQUIRED")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    age_seconds = (current.astimezone(timezone.utc) - observed.astimezone(timezone.utc)).total_seconds()
    if age_seconds < 0:
        raise ReadPolicyDenied("OBSERVATION_FROM_FUTURE")
    if age_seconds > max_age_seconds:
        raise ReadPolicyDenied("STALE_OBSERVATION")


@dataclass(frozen=True)
class ReadObservation:
    observation_id: str
    source_id: str
    target_id: str
    url: str
    status: int
    observed_at: str
    content_type: str
    body_digest: str
    body_size: int
    collector_id: str
    transport_id: str
    verification_state: str
    parsed_payload: object

    def evidence_payload(self) -> dict:
        """Return immutable observation metadata that is safe to hash/store as Evidence."""
        return {
            "observation_id": self.observation_id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "url": self.url,
            "status": self.status,
            "observed_at": self.observed_at,
            "content_type": self.content_type,
            "body_digest": self.body_digest,
            "body_size": self.body_size,
            "collector_id": self.collector_id,
            "transport_id": self.transport_id,
            "verification_state": self.verification_state,
        }

    def require_fresh(self, *, max_age_seconds: float, now: datetime | None = None) -> None:
        """Fail closed when an observation is stale or has an invalid/future timestamp."""
        require_fresh_timestamp(
            observed_at=self.observed_at,
            max_age_seconds=max_age_seconds,
            now=now,
        )

    def provenance_payload(
        self,
        *,
        max_age_seconds: float,
        now: datetime | None = None,
    ) -> dict[str, object]:
        """Return the stable Phase-3 provenance contract only after freshness passes."""
        self.require_fresh(max_age_seconds=max_age_seconds, now=now)
        return {
            "observation_id": self.observation_id,
            "source": self.source_id,
            "target_id": self.target_id,
            "observed_url": self.url,
            "status": self.status,
            "observed_at": self.observed_at,
            "body_digest": self.body_digest,
            "body_size": self.body_size,
            "freshness_result": "FRESH",
            "freshness_max_age_seconds": max_age_seconds,
            "collector_id": self.collector_id,
            "transport_id": self.transport_id,
            "verification_state": self.verification_state,
        }


class ReadBroker:
    """Deterministic read-only broker.

    The broker exposes only GET-style JSON reads. Credentials cannot be supplied by callers;
    an injected backend transport owns authentication and agents receive only observations.
    """

    def __init__(self, *, policies: Mapping[str, ReadSourcePolicy], transport: ReadTransport) -> None:
        self._policies = dict(policies)
        self._transport = transport

    def fetch_json(self, *, source_id: str, url: str) -> ReadObservation:
        policy = self._policies.get(source_id)
        if not policy:
            raise ReadPolicyDenied("UNKNOWN_SOURCE")
        policy.validate_url(url)
        try:
            response = self._transport(url=url, timeout=policy.timeout_seconds)
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
            target_id=_canonical_target_id(source_id=source_id, url=url),
            url=url,
            status=response.status,
            observed_at=observed_at,
            content_type=content_type,
            body_digest=sha256(response.body).hexdigest(),
            body_size=len(response.body),
            collector_id="alpha_orchestrator.read_plane.ReadBroker",
            transport_id=_transport_provenance_id(self._transport),
            verification_state="READ_VALIDATED",
            parsed_payload=payload,
        )
