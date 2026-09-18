# Phase 4 Exit Evidence - 2026-09-18

Status: **READY FOR HUMAN PHASE-4 EXIT REVIEW - DEVELOPMENT ONLY**

Applies to: Frozen integrated roadmap Phase 4 SHADOW plus approved Premium Frontend Acceptance amendment.

This document records evidence only. It does not merge a protected branch, deploy a later commit, authorize Phase 5 write behavior or approve production use.

## 1. Current baseline and evidence precedence

Authority order used for this review:

1. current branch code;
2. automated tests and CI;
3. controlled runtime evidence;
4. external DEVELOPMENT/PREVIEW runtime evidence;
5. roadmap / amendments / decision documents.

Current implementation baseline:

`phase4/premium-mission-control-remediation@1be20b48668924973ffe698f8f61eb0993782a58`

Verified on that baseline:

- `control-plane-ci #232` -> SUCCESS;
- `full-system-validation #154` -> SUCCESS;
- backend validation -> SUCCESS;
- frontend validation/build -> SUCCESS;
- browser E2E -> SUCCESS;
- read-only runtime smoke -> SUCCESS;
- external Operations Preview smoke -> SUCCESS.

PR #35 remains open, draft and unmerged.

## 2. Real Phase 4 SHADOW Work Order path

CONFIRMED in repository code and controlled browser runtime:

- `ShadowTaskRunner` executes the real read-only path through `ReadBroker` and `ShadowReadService`;
- a backend-owned `WorkOrder` is retained after successful read, verification, finding creation, independent review and plan creation;
- the Work Order is marked `VERIFIED` only after the existing Shadow verification and independent-review conditions succeed;
- Evidence and Finding records retain backend verification/freshness metadata;
- the proposed Writer remains proposal-only and no capability is granted;
- `capabilities_granted == 0`;
- `external_writes == 0`;
- the controlled E2E runtime performs a real GitHub GET-only read using the repository-owned GitHub read transport;
- browser E2E renders the resulting Work Order, Evidence, Finding and Plan contracts in the Operations Console.

The frontend does not invent an authoritative lifecycle stage. Where no authoritative lifecycle-stage contract exists, the lifecycle stage remains UNKNOWN.

## 3. Phase 4.4 / 4.5 Premium Operations Console

CONFIRMED:

- repository-owned React/TypeScript/Vite Operations Console;
- Global Header and navigation;
- Active Context Bar;
- Mission Control;
- Leader surface;
- Work Order and lifecycle surfaces when contracts are available;
- Findings and Evidence surfaces;
- topology / Agent observability surface;
- Agent Grid;
- Trace / Waterfall;
- Recent Events surface;
- authoritative Control Rail;
- explicit UNKNOWN / STALE / UNAVAILABLE semantics;
- no Phase 5 operational write controls.

CI produces populated desktop 1440x1000 and narrow 320x800 visual evidence.

The explicit Human Phase-4 Exit / Phase-5 Entry decision is still required and is not inferred from CI.

## 4. Non-overlap / responsive visual safety

CONFIRMED:

- topology Tools & Data is outside the Agent viewport in a dedicated dock;
- topology overflow is constrained to its grid region;
- visual-QA banner does not overlay console content;
- browser E2E contains bounding-box regression checks for critical overlap cases;
- desktop and narrow visual-QA evidence are produced by CI;
- reduced-motion behavior is covered;
- safety-critical authority state remains visible in narrow and desktop layouts.

## 5. Backend-owned view contracts

CONFIRMED:

- frontend consumes backend-shaped `ViewContract` values;
- source class, availability and reason metadata are preserved;
- strict snapshot adapter rejects invalid field metadata and duplicate singleton contracts;
- SYSTEM_STATE is required for a valid authoritative snapshot;
- frontend does not infer active Work Order or Leader authority from ambiguous collections;
- unavailable data remains unavailable rather than being fabricated;
- Evidence verification, Finding classification, approval state, policy results and write eligibility are not recalculated by the frontend.

## 6. Phase 4.11 live-event safety

CONFIRMED:

- canonical `LiveEventEnvelope`;
- schema version validation;
- event identity and sequence validation;
- duplicate detection;
- missing-sequence detection;
- stale/out-of-order rejection;
- state-version continuity validation;
- unsupported event application fails closed;
- typed `VIEW_CONTRACT_SYSTEM_STATE` event family;
- repository-owned `LiveEventProducer`;
- canonical SSE framing;
- fetch-based browser SSE consumption.

## 7. Real producer and external delivery path

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

The external smoke now performs a bounded health warm-up before the strict contract checks so a Render free-tier cold start does not create a false negative. The contract checks themselves remain unchanged.

The deployed producer currently emits the authoritative SYSTEM_STATE event once per runtime instance and then remains quiet until a real ongoing authority-change source exists. No ongoing change subscription is invented.

Runtime/Telemetry/Agent fields that are not wired remain unavailable.

## 8. Phase 4.12 mounted browser resilience

CONFIRMED in controlled real HTTP/SSE browser runtime:

- default application mounts `OperationsLiveProvider`;
- preview credential entry is DEVELOPMENT/PREVIEW-only and explicit opt-in;
- credential stays in browser memory;
- active preview read-session status remains visible across route navigation;
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

The deterministic HTTP/SSE harness is used only to create reproducible disconnect/gap/unavailable conditions. It exercises the same gateway/client/session contracts and now supplies a real read-only Shadow Work Order contract set from the real GitHub read path.

## 9. Heartbeat applicability

CONFIRMED for current Phase 4 DEVELOPMENT/PREVIEW transport:

- the verified SSE contract is finite and deliberately exercises reconnect;
- authority does not depend on a heartbeat;
- no current evidence requires an application heartbeat.

A future long-lived production transport must re-evaluate heartbeat/liveness from runtime evidence.

## 10. Current / stale / unavailable separation

CONFIRMED:

- connection status and snapshot freshness are separate state machines;
- authority requires CONNECTED + CURRENT;
- connection loss cannot leave retained state presented as current authority;
- RESYNC_REQUIRED cannot be promoted to current without snapshot resync;
- UNAVAILABLE is explicit;
- Active Context Bar reflects fail-closed state.

## 11. Secret boundary

CONFIRMED:

- preview bearer is not committed;
- preview bearer is not a provider credential;
- GitHub Actions consumes the credential through repository secrets;
- the real GitHub read E2E uses the GitHub Actions token with repository `contents: read` permission;
- checkout persists no credentials;
- browser credential input is a password field and clears after connect;
- no localStorage/sessionStorage/cookie persistence;
- no URL/query token transport;
- no secret value is required in logs;
- snapshot/SSE authorization failure emits no authoritative body.

## 12. Fault isolation and accessibility

CONFIRMED by repository tests / browser E2E:

- route-level rendering is isolated by error boundaries;
- primary navigation keyboard behavior is covered;
- visible focus behavior is covered;
- reduced-motion behavior is covered;
- non-color text labels communicate authority/state;
- explicit UNKNOWN / STALE / FAILED / UNAVAILABLE semantics exist;
- responsive layouts preserve authority context.

## 13. Phase 4 write-safety boundary

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

The real Shadow E2E asserts zero capabilities and zero external writes.

## 14. External runtime / deployment boundary

CONFIRMED:

Dedicated Render DEVELOPMENT/PREVIEW Operations service exists with auto-deploy disabled.

Last independently confirmed live deployment:

- service id: `srv-dam5g5gu01pc73bia2t0`;
- deploy id: `dep-dam5q5m5vjqs73bs36qg`;
- deployed commit: `b4ae402ba192c953fa86b56d16c1446b4fc16068`;
- status: live.

The current branch HEAD `1be20b48668924973ffe698f8f61eb0993782a58` is not claimed as deployed.

The green external smoke proves compatibility with the deployed protected read service, not deployment of the newer branch code.

## 15. Known limitations that remain explicit

- production identity/auth is unresolved;
- the external preview producer has no ongoing repository-owned authority-change subscription beyond its current SYSTEM_STATE emission;
- the external Render preview does not yet serve the newer real Shadow Work Order contract set from current branch HEAD;
- the real Shadow Work Order path is proven in controlled CI browser runtime, not by the currently deployed Render commit;
- lifecycle stage remains UNKNOWN without an authoritative lifecycle-stage contract;
- later premium visual refinement may still occur without changing Phase 4 authority boundaries;
- the dedicated external service does not imply production traffic/readiness;
- no Phase 5 write capability exists;
- no Phase 6 adversarial/performance completion is claimed;
- no Phase 7 LIVE_GATED readiness is claimed.

## 16. Exit assessment

Against the Phase 4 SHADOW scope and Premium Frontend Acceptance amendment, the current branch has technical evidence for:

- premium read-only console baseline;
- backend-owned contract safety;
- a real read-only Shadow Work Order path from request/read/verification/finding/plan into the browser Console;
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

**Assessment: Phase 4 implementation is technically ready for the explicit Human Phase-4 Exit / Phase-5 Entry Gate.**

This assessment does not itself approve that gate.

## 17. Required Human Gate

A human must explicitly decide whether to:

1. accept Phase 4 SHADOW as complete for roadmap progression; and
2. authorize entry into Phase 5 SANDBOX planning/implementation.

Until that approval:

- PR #35 remains unmerged;
- no protected-branch merge is authorized;
- no deployment of the newer branch HEAD is authorized;
- no Phase 5 active write control is authorized.
