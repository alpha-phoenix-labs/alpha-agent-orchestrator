from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

from .live_events import LiveEventEnvelope
from .live_sse import encode_sse_event
from .view_contracts import ContractName, SourceClass, ViewContract, view_payload


OPERATIONS_READ_SNAPSHOT_SCHEMA_VERSION = 1


class OperationsReadError(RuntimeError):
    """Base error for the transport-neutral Operations read boundary."""


class OperationsReadUnauthorized(OperationsReadError):
    """Authorization failed or was not available for an Operations read."""


class OperationsReadSnapshotError(OperationsReadError):
    """The supplied backend view contracts cannot form a safe snapshot."""


class OperationsReadAuthorizer(Protocol):
    """Opaque read-only authorization decision supplied by a later network adapter."""

    def authorize(self, auth_context: object | None) -> None:
        """Return normally when read access is allowed, otherwise raise."""


@dataclass(frozen=True)
class OperationsReadSnapshot:
    """Backend-owned transport aggregate built only from ViewContract values."""

    contracts: tuple[ViewContract, ...]

    @classmethod
    def from_contracts(cls, contracts: Iterable[ViewContract]) -> "OperationsReadSnapshot":
        return cls(tuple(contracts))

    def __post_init__(self) -> None:
        system_contracts = [
            contract
            for contract in self.contracts
            if contract.contract is ContractName.SYSTEM_STATE
        ]
        if len(system_contracts) != 1:
            raise OperationsReadSnapshotError("OPERATIONS_SNAPSHOT_REQUIRES_ONE_SYSTEM_STATE")

        state_field = system_contracts[0].fields["state_version"]
        if state_field.source_class is not SourceClass.AUTHORITATIVE:
            raise OperationsReadSnapshotError("OPERATIONS_SNAPSHOT_STATE_VERSION_NOT_AUTHORITATIVE")
        if not state_field.available:
            raise OperationsReadSnapshotError("OPERATIONS_SNAPSHOT_STATE_VERSION_UNAVAILABLE")
        if not isinstance(state_field.value, str) or not state_field.value.strip():
            raise OperationsReadSnapshotError("OPERATIONS_SNAPSHOT_INVALID_STATE_VERSION")

    @property
    def state_version(self) -> str:
        system_state = next(
            contract
            for contract in self.contracts
            if contract.contract is ContractName.SYSTEM_STATE
        )
        value = system_state.fields["state_version"].value
        assert isinstance(value, str)
        return value

    def payload(self) -> dict[str, object]:
        return {
            "schema_version": OPERATIONS_READ_SNAPSHOT_SCHEMA_VERSION,
            "state_version": self.state_version,
            "contracts": [view_payload(contract) for contract in self.contracts],
        }

    def encode_json(self) -> bytes:
        return json.dumps(
            self.payload(),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")


class OperationsReadBoundary:
    """Shared fail-closed authorization boundary for snapshot and SSE reads.

    This type intentionally owns no HTTP route, credential format, CORS policy,
    replay policy, heartbeat cadence, provider credential or write capability.
    """

    __slots__ = ("_authorizer",)

    def __init__(self, *, authorizer: OperationsReadAuthorizer | None) -> None:
        if authorizer is None:
            raise OperationsReadUnauthorized("OPERATIONS_READ_AUTHORIZER_REQUIRED")
        self._authorizer = authorizer

    def _authorize(self, auth_context: object | None) -> None:
        try:
            self._authorizer.authorize(auth_context)
        except OperationsReadUnauthorized:
            raise
        except Exception as exc:
            raise OperationsReadUnauthorized("OPERATIONS_READ_AUTHORIZATION_FAILED") from exc

    def snapshot(
        self,
        *,
        auth_context: object | None,
        contracts: Iterable[ViewContract],
    ) -> bytes:
        self._authorize(auth_context)
        return OperationsReadSnapshot.from_contracts(contracts).encode_json()

    def sse_event(
        self,
        *,
        auth_context: object | None,
        event: LiveEventEnvelope,
    ) -> bytes:
        self._authorize(auth_context)
        return encode_sse_event(event)
