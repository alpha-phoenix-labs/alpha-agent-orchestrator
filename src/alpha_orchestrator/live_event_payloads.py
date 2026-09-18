from __future__ import annotations

from typing import Any

from .live_events import LiveEventValidationError
from .view_contracts import ContractName, SourceClass, ViewContract


SYSTEM_STATE_VIEW_EVENT_TYPE = "VIEW_CONTRACT_SYSTEM_STATE"


def build_system_state_event_payload(contract: ViewContract) -> dict[str, Any]:
    """Serialize the existing authoritative SYSTEM_STATE view contract as a typed event payload.

    This function adds no new domain semantics. It mirrors the already-defined
    SYSTEM_STATE fields and records their existing AUTHORITATIVE provenance.
    """

    if contract.contract is not ContractName.SYSTEM_STATE:
        raise LiveEventValidationError("SYSTEM_STATE_CONTRACT_REQUIRED")

    mode_field = contract.fields["mode"]
    writes_field = contract.fields["writes_enabled"]
    state_field = contract.fields["state_version"]

    for name, field in (
        ("mode", mode_field),
        ("writes_enabled", writes_field),
        ("state_version", state_field),
    ):
        if field.source_class is not SourceClass.AUTHORITATIVE:
            raise LiveEventValidationError(f"SYSTEM_STATE_SOURCE_NOT_AUTHORITATIVE:{name}")
        if not field.available:
            raise LiveEventValidationError(f"SYSTEM_STATE_FIELD_UNAVAILABLE:{name}")

    if not isinstance(mode_field.value, str) or not mode_field.value.strip():
        raise LiveEventValidationError("INVALID_SYSTEM_STATE_MODE")
    if type(writes_field.value) is not bool:
        raise LiveEventValidationError("INVALID_SYSTEM_STATE_WRITES_ENABLED")
    if not isinstance(state_field.value, str) or not state_field.value.strip():
        raise LiveEventValidationError("INVALID_SYSTEM_STATE_VERSION")

    return {
        "contract": ContractName.SYSTEM_STATE.value,
        "source_class": SourceClass.AUTHORITATIVE.value,
        "mode": mode_field.value,
        "writes_enabled": writes_field.value,
        "state_version": state_field.value,
    }
