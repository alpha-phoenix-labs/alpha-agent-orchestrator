from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json

from .models import EvidenceRef
from .read_plane import ReadBroker, ReadObservation


@dataclass(frozen=True)
class ShadowFinding:
    reader_id: str
    claim: str
    evidence: EvidenceRef
    observation_id: str


def observation_to_evidence(obs: ReadObservation) -> EvidenceRef:
    raw = json.dumps(obs.evidence_payload(), sort_keys=True, separators=(",", ":"))
    return EvidenceRef(
        source=obs.source_id,
        reference=obs.url,
        observed_at=obs.observed_at,
        digest=sha256(raw.encode("utf-8")).hexdigest(),
    )


class ShadowReadService:
    """Read-only ingestion path. It cannot create approvals or invoke WriteProxy."""

    def __init__(self, broker: ReadBroker) -> None:
        self.broker = broker

    def inspect_json(self, *, reader_id: str, source_id: str, url: str, claim_builder) -> ShadowFinding:
        obs = self.broker.fetch_json(source_id=source_id, url=url)
        claim = claim_builder(obs.parsed_payload)
        return ShadowFinding(
            reader_id=reader_id,
            claim=str(claim),
            evidence=observation_to_evidence(obs),
            observation_id=obs.observation_id,
        )
