# Roadmap Amendment - 2026-09-16 - Phase 3 status synchronization and UI baseline

Status: **APPROVED STATUS/TRACEABILITY AMENDMENT - NO PHASE REORDERING**  
Applies to: `docs/INTEGRATED_ROADMAP.md`  
Base roadmap status: frozen/binding  
Repository baseline: `main@c30cb46524c500c9e47282e79fcfb6a0528bb9d5`

## 1. Reason

The frozen roadmap contains Phase 3 status labels and an execution pointer that reflect the moment of PDF freeze, not the later completed work. The user explicitly directed the project to work through the remaining UI-injection points so that the roadmap state is fully current before continuing.

This amendment synchronizes **status and execution position only**. It does not remove, weaken, reorder or bypass any phase, gate or acceptance criterion.

## 2. Scope

This amendment records:

- current evidence for Phase 3.3 redirect hardening;
- current evidence for Phase 3.4 Render runtime verification;
- current evidence for Phase 3.5 provenance/freshness closure;
- completion of the Phase 3.6 UI contract baseline;
- the remaining evidence needed before the Phase 3 exit gate may be declared complete;
- the current execution pointer.

The frozen base roadmap remains preserved as historical sequence evidence.

## 3. Phase 3 status synchronization

### 3.1 GitHub real read-only

Roadmap section 6.1 status remains: **RUNTIME EVIDENCE EXISTS**.

The previously established real GitHub read evidence remains the runtime evidence for the constrained GitHub read path. Current code additionally exposes the Phase 3.5 provenance contract, but the current-main expanded contract should be refreshed before final Phase 3 closure.

### 3.2 Render read-only boundary

Roadmap section 6.2 status remains: **MERGED + CI VERIFIED**.

### 3.3 Credentialed HTTP redirect fail-closed hardening

Effective status: **COMPLETE + REGRESSION COVERED**.

Current main contains `connectors/http_safety.py` with a `FailClosedRedirectHandler` that rejects redirects with `HTTP_REDIRECT_DENIED` before a credentialed follow-up request can be constructed. The test suite contains `tests/test_http_redirect_safety.py`. The current main CI suite passes.

This closes the stale frozen-roadmap label `OPEN - NEXT ACTIVE TECHNICAL GATE` without changing its acceptance criteria.

### 3.4 Render repository runtime verification

Effective status: **RUNTIME VERIFIED FOR THE APPROVED CONSTRAINED PROXY BOUNDARY**.

Recorded real read evidence from 2026-09-16:

- source: `render`;
- HTTP status: `200`;
- observed service count: `12`;
- `write_capability_exposed: false`;
- observed timestamp: `2026-09-16T15:52:49.218789+00:00`;
- prior output also recorded body digest and body size;
- no provider credential was returned in the response;
- the request was a GET through the approved constrained proxy surface.

The live Render deployment currently identified as `dep-dalbl9id0e5s73eqk3hg` is built from repository commit `9f0f9dfbeab133a4fa22a157442bba612f30dfdc`.

This closes the stale frozen-roadmap label `OPEN - BLOCKED BY 6.3 AND CREDENTIAL/PROXY GATE` for the Phase 3.4 boundary itself.

### 3.5 Evidence provenance and freshness closure

Effective status: **MERGED + CI VERIFIED; CURRENT-MAIN RUNTIME REFRESH PENDING**.

PR #12 was merged to current main as:

`c30cb46524c500c9e47282e79fcfb6a0528bb9d5`

The merged contract includes:

- logical source;
- target identity;
- observed URL;
- observed time;
- body digest and size;
- freshness result/window;
- collector identity;
- transport identity;
- verification state;
- fail-closed handling of stale, future, malformed, timezone-less and invalid freshness inputs;
- planning-time freshness revalidation for Shadow evidence.

Post-merge CI run `35121825770` completed successfully with `94 passed`.

The remaining issue is **runtime alignment**, not implementation correctness: the live Render proxy still runs the earlier Phase 3.4 commit `9f0f9df...`, so the expanded Phase 3.5 contract on current main has not yet been demonstrated end-to-end against that live path.

### 3.6 UI contract baseline

Effective status: **ARCHITECTURE BASELINE COMPLETE**.

Authoritative artifact:

`docs/UI_CONTRACT_BASELINE.md`

The baseline:

- inventories every backend vocabulary item required by roadmap section 6.6;
- distinguishes CONFIRMED, PARTIAL and UNKNOWN contracts;
- keeps `SystemMode` separate from `writes_enabled` and write eligibility;
- identifies UI concept labels that are not yet backend facts;
- resolves the current repository/frontend-stack unknown at the correct level;
- captures the V1 Desktop Master Wireframe as a planning contract;
- maps the remaining UI-injection requirements to Phases 4-7 or the deferred backlog;
- introduces no frontend implementation or new dependency.

## 4. Phase 3 exit gate status

Effective Phase 3 status remains: **IN PROGRESS**.

The remaining blocker is evidence alignment with **current main**, not a missing UI planning item.

Because Phase 3.5 changed the real-reader provenance contract after the earlier runtime captures, the final Phase 3 exit claim must be made against the current repository state rather than silently inheriting runtime evidence from an older deployed commit.

Minimum remaining evidence before declaring Phase 3 complete:

1. current-main GitHub real-read smoke demonstrates the expanded provenance/freshness contract without write capability;
2. current-main Render constrained-proxy deployment demonstrates the expanded provenance/freshness contract with no credential output and `write_capability_exposed=false`;
3. no mutation is performed as part of those read validations.

This is not a new roadmap gate. It is the evidence needed to prove the existing Phase 3.5 and Phase 3 exit criteria against the current source of truth.

## 5. Current execution pointer

The frozen document's historical pointer at Phase 3.3 is superseded for current execution by this explicit amendment.

Current pointer:

**Phase 3 exit runtime refresh on current main -> close Phase 3 -> enter Phase 4 in roadmap order.**

Required sequence:

1. preserve current backend/UI contract baseline;
2. deploy/execute only the explicitly approved read-only current-main validation path;
3. capture current-main GitHub provenance/freshness runtime evidence;
4. capture current-main Render proxy provenance/freshness runtime evidence;
5. verify no credential or mutation capability was exposed;
6. declare Phase 3 complete only after those existing exit criteria are evidenced;
7. begin Phase 4 at Shadow core / authoritative read-model work;
8. select a frontend stack only at the roadmap's Phase 4.3 point after contract review.

## 6. UI-injection coverage conclusion

No UI concept item identified in the project-source UI document is currently missing from the integrated roadmap sequence after applying `docs/UI_CONTRACT_BASELINE.md`:

- backend/UI vocabulary: Phase 3.6;
- master Mission Control layout planning: Phase 3.6 architecture artifact, implementation Phase 4;
- Operations Console: Phase 4;
- frontend stack selection: Phase 4.3;
- topology/Agent Grid/trace/event stream: Phase 4;
- stream resilience/schema/state drift: Phase 4;
- Human Gate/write UX/freeze/post-verify: Phase 5;
- adversarial UI/runtime acceptance: Phase 6;
- integrated go-live: Phase 7;
- optional premium/deferred visual and scale infrastructure: roadmap deferred backlog.

The roadmap sequence therefore remains authoritative and no parallel UI roadmap is required.
