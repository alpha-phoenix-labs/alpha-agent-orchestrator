# Phase 4 Exit Evidence - 2026-09-18

Status: **READY FOR HUMAN PHASE-4 EXIT REVIEW - DEVELOPMENT ONLY**

Applies to: Frozen integrated roadmap Phase 4 SHADOW plus approved Premium Frontend Acceptance amendment.

This document records evidence only. It does not merge a protected branch, deploy a later commit, authorize Phase 5 write behavior or approve production use.

## 1. Baseline and evidence precedence

Authority order used for this review:

1. current branch code;
2. automated tests and CI;
3. controlled runtime evidence;
4. external DEVELOPMENT/PREVIEW runtime evidence;
5. roadmap / amendments / decision documents.

Implementation evidence baseline before this exit-evidence document:
`da218043e158a8735f8a0f3a54cd9e532c726ebf`

Verified on that baseline:

- `control-plane-ci #221` -> SUCCESS;
- `full-system-validation #143` -> SUCCESS;
- backend validation -> SUCCESS;
- frontend validation/build -> SUCCESS;
- browser E2E -> SUCCESS;
- read-only runtime smoke -> SUCCESS;
- external Operations Preview smoke -> SUCCESS.

## 2. Phase 4.4 / 4.5 Premium Operations Console

CONFIRMED:

- repository-owned React/TypeScript/Vite Operations Console;
- Global Header and navigation;
- Active Context Bar;
- Mission Control;
- Leader surface;
- active Work Order/lifecycle surfaces when contracts are available;
- Findings and Evidence surfaces;
- topology / Agent observability surface;
- Agent Grid;
- Trace / Waterfall;
- Recent Events;
- authoritative Control Rail;
- explicit UNKNOWN / UNAVAILABLE semantics;
- no Phase 5 operational write controls.

Human visual review accepted the current 1440px development baseline on 2026-09-18 with explicit intent to refine premium visuals later.

The acceptance is not a claim that visual design is final for product release. It is the Human Gate acceptance for continuing the roadmap.

## 3. Non-overlap / responsive visual safety

CONFIRMED:

- topology Tools & Data was moved out of the Agent viewport into a dedicated dock;
- topology overflow is constrained to its grid region;
- visual-QA banner no longer overlays console content;
- browser E2E contains bounding-box regression checks for critical overlap cases;
- desktop 1440x1000 evidence and narrow 320x800 evidence are produced by CI;
- reduced-motion behavior is covered;
- safety-critical authority state remains visible in narrow and desktop layouts.

## 4. Backend-owned view contracts

CONFIRMED:

- frontend consumes backend-shaped `ViewContract` values;
- source class, availability and reason metadata are preserved;
- strict snapshot adapter rejects invalid field metadata and duplicate singleton contracts;
- SYSTEM_STATE is required for a valid authoritative snapshot;
- frontend does not infer active Work Order or Leader authority from ambiguous collections;
- unavailable data remains unavailable rather than being fabricated.

## 5. Phase 4.11 live-event safety

CONFIRMED:

- canonical `LiveEventEnvelope`;
- schema version validation;
- event identity and sequence validation;
- duplicate detection;
- missing-sequence detection;
- stale/out-of-order rejection;
- state-version continuity validation;
- unsupported event application fails closed;
- one typed `VIEW_CONTRACT_SYSTEM_STATE` event family;
- repository-owned `LiveEventProducer`;
- canonical SSE framing;
- fetch-based browser SSE consumption.

## 6. Real producer and delivery path

CONFIRMED:

The dedicated DEVELOPMENT/PREVIEW Operations service provides a real repository-owned producer + HTTP/SSE delivery path.

External CI smoke verifies:

- service health;
- unauthorized snapshot rejection;
- authenticated authoritative snapshot;
- canonical SSE delivery;
- SHADOW mode;
- writes disabled;
- mutation rejection.

The deployed real producer currently emits the authoritative SYSTEM_STATE event once per runtime instance and then remains quiet until a real ongoing authority-change source exists.

This limitation is explicit. No ongoing change subscription is invented.

Runtime/Telemetry/Agent fields that are not wired remain unavailable. Therefore no snapshot-only or fixture data is silently presented as real live Runtime/Telemetry authority.

## 7. Phase 4.12 mounted browser resilience

CONFIRMED in controlled real HTTP/SSE browser runtime:

- default application mounts `OperationsLiveProvider`;
- preview credential entry is DEVELOPMENT/PREVIEW-only and explicit opt-in;
- credential stays in browser memory;
- snapshot and SSE use the same bearer credential;
- initial authoritative snapshot is required before authority becomes current;
- live SYSTEM_STATE event application updates state/version continuity;
- stream disconnect marks retained data stale;
- bounded reconnect scheduling is dispatched;
- reconnect passes through CONNECTING;
- reconnect alone does not restore authority;
- fresh snapshot is required before authority returns;
- sequence gap produces `RESYNC_REQUIRED`;
- automatic authoritative snapshot resync restores CURRENT only after validation;
- failed snapshot/resync produces UNAVAILABLE;
- retained stale state is hidden from current authority surfaces;
- current authority fields fall back to UNKNOWN;
- localStorage/sessionStorage/cookies remain empty.

The deterministic HTTP/SSE harness is used only to create reproducible disconnect/gap/unavailable conditions. It exercises the same gateway/client/session contracts rather than substituting mock data into production authority paths.

## 8. Heartbeat applicability

CONFIRMED for current Phase 4 DEVELOPMENT/PREVIEW transport:

- the verified SSE contract is finite and deliberately exercises reconnect;
- authority does not depend on a heartbeat;
- no evidence currently requires an application heartbeat.

Therefore no speculative heartbeat interval is introduced.

A future long-lived production transport must re-evaluate heartbeat/liveness from runtime evidence.

## 9. Current / stale / unavailable separation

CONFIRMED:

- connection status and snapshot freshness are separate state machines;
- authority requires CONNECTED + CURRENT;
- connection loss cannot leave retained state presented as current authority;
- RESYNC_REQUIRED cannot be promoted to current without snapshot resync;
- UNAVAILABLE is explicit;
- Active Context Bar reflects fail-closed state.

## 10. Secret boundary

CONFIRMED:

- preview bearer is not committed;
- preview bearer is not a provider credential;
- GitHub Actions consumes the credential through repository secrets;
- browser credential input is a password field and clears after connect;
- no localStorage/sessionStorage/cookie persistence;
- no URL/query token transport;
- no token logging is required by the implementation;
- snapshot/SSE authorization failure emits no authoritative body.

## 11. Fault isolation and accessibility

CONFIRMED by repository tests / browser E2E:

- route-level rendering is isolated by error boundaries;
- primary navigation keyboard behavior is covered;
- visible focus behavior is covered;
- reduced-motion behavior is covered;
- non-color text labels communicate authority/state;
- explicit UNKNOWN / STALE / UNAVAILABLE semantics exist;
- responsive layouts preserve authority context.

## 12. Phase 4 write-safety boundary

CONFIRMED:

No active UI control or backend capability has been introduced for:

- START / STOP Agent;
- SEND COMMAND;
- ASSIGN TASK;
- CHANGE PROMPT;
- ENABLE WRITER;
- approval execution;
- deploy;
- force unlock;
- policy override;
- forced execution.

The preview session control grants read authorization only.

## 13. External runtime / deployment boundary

CONFIRMED:

Dedicated Render DEVELOPMENT/PREVIEW Operations service exists with auto-deploy disabled.

Last independently confirmed live deployment:

- service id: `srv-dam5g5gu01pc73bia2t0`;
- deploy id: `dep-dam5q5m5vjqs73bs36qg`;
- deployed commit: `b4ae402ba192c953fa86b56d16c1446b4fc16068`;
- status: live.

Later branch commits are not claimed as deployed.

The green external smoke proves compatibility with the deployed protected read service, not deployment of the newer branch code.

## 14. Known limitations that do not get hidden

- production identity/auth is unresolved;
- the real preview producer has no ongoing repository-owned authority-change subscription beyond its current SYSTEM_STATE emission;
- later premium visual refinement is explicitly deferred by Human acceptance;
- the dedicated external service does not imply production traffic/readiness;
- no Phase 5 write capability exists;
- no Phase 6 adversarial/performance completion is claimed;
- no Phase 7 LIVE_GATED readiness is claimed.

## 15. Exit assessment

Against the Phase 4 SHADOW scope and Premium Frontend Acceptance amendment, the repository now has evidence for:

- premium read-only console baseline;
- Human visual acceptance;
- backend-owned contract safety;
- real producer + protected SSE delivery;
- mounted browser snapshot/SSE client;
- actual reconnect dispatch;
- bounded backoff;
- sequence-gap handling;
- automatic snapshot resync;
- failed resync;
- stale marking;
- authority unavailable;
- responsive/accessibility safety checks;
- secret-safe preview authentication;
- no Phase 5 write controls.

**Assessment: Phase 4 implementation is ready for the explicit Human Phase-4 Exit / Phase-5 Entry Gate.**

This assessment does not itself approve that gate.

## 16. Required Human Gate

A human must explicitly decide whether to:

1. accept Phase 4 SHADOW as complete for roadmap progression; and
2. authorize entry into Phase 5 SANDBOX planning/implementation.

Until that approval:

- PR #35 remains unmerged;
- no protected-branch merge is authorized;
- no new deployment is authorized;
- no Phase 5 active write control is authorized.
