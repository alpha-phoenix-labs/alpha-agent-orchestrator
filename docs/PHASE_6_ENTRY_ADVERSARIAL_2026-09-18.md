# Phase 6 Entry - Adversarial Validation

Status: **PHASE 6 STARTED - DEVELOPMENT ONLY**  
Repository: `alpha-phoenix-labs/alpha-agent-orchestrator`  
Branch: `phase6/adversarial-validation`  
Base: Phase-5 closure HEAD `b5fb8d47fbadc8ad9bcca42de8b64e21abc9b7e6`

## Safety boundary

Phase 6 is adversarial validation only.

Not authorized:

- protected-branch merge;
- Render or production deploy;
- production write;
- LIVE_GATED activation;
- production data/secret mutation;
- security-rule weakening;
- replacing fail-closed behavior with permissive fallback.

Adversarial writes, where required, must use isolated local test sandboxes only.

## Required adversarial matrix

Phase 6 must exercise, at minimum:

- stale Base SHA;
- stale State Version;
- approval replay;
- duplicate execution;
- approval invalidation after state/plan/base changes;
- exact-target lock loss;
- lock race / competing writer attempt;
- writer scope violation;
- verifier disagreement / failed Post Verify;
- control-plane/authority unavailability;
- Emergency Freeze before and during execution preparation;
- stale, delayed, duplicate and out-of-order UI events;
- event gap / reconnect / resync failure;
- malformed schema;
- telemetry contradicting authority;
- Evidence stale / authority unavailable;
- agent self-claims attempting to manufacture authority;
- frontend-local security derivation attempts;
- secret, raw capability and credential leakage attempts.

## Exit boundary

Phase 6 may close only when the adversarial matrix is implemented, CI is green on the final exact HEAD, and the Human Phase-6 Exit gate is explicitly approved.

No Phase-7 LIVE_GATED work may begin before that gate.
