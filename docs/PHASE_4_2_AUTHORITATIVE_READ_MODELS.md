# PHASE 4.2 — Authoritative Read Models / View Contracts

Status: **PATCH PREPARED — NO FRONTEND IMPLEMENTATION**

Baseline: `main@b206a16bfa08ccdc1f579123b65499bb5bde3d4e`

## Purpose

This patch implements the backend contract boundary required by frozen-roadmap section **7.2**.

The goal is not to create a frontend. The goal is to make UI-facing backend data explicit enough that a later frontend cannot silently invent authority, lifecycle state, finding classification, runtime health, connector health or telemetry.

The six roadmap source-of-truth classes are represented exactly:

- `AUTHORITATIVE`
- `WORK_ORDER`
- `EVIDENCE`
- `RUNTIME`
- `TELEMETRY`
- `LOCAL_UI`

`LOCAL_UI` exists in the vocabulary but is intentionally not used to populate backend or security state.

## Contract module

`src/alpha_orchestrator/view_contracts.py` provides pure Python read/view contracts and serialization.

Every visible field is represented by `ViewField`, which carries:

- `source_class`;
- `available`;
- `value`;
- an explicit `reason` when unavailable.

Unavailable values fail closed: they cannot simultaneously contain a value, and an unavailable field must explain why it is unavailable.

`ViewContract` validates the exact field set and allowed source class for each contract. This prevents callers from relabeling telemetry or local presentation state as authoritative security state.

## Roadmap 7.2 coverage

| Roadmap contract | Backend view contract | Current authority behavior |
|---|---|---|
| System State | `SYSTEM_STATE` | mode, writes-enabled and state-version are `AUTHORITATIVE` |
| Canonical State | `CANONICAL_STATE` | repository/branch/HEAD/observation/freshness shape is `AUTHORITATIVE`; values may remain explicitly unavailable until observed |
| Work Orders | `WORK_ORDER` | maps existing `WorkOrder` fields as `WORK_ORDER` |
| Lifecycle | `LIFECYCLE` | existing `OrderStatus` is available; separate lifecycle stage remains explicit UNKNOWN |
| Evidence | `EVIDENCE` | maps `EvidenceRef`; verification is populated only when backend provenance supplies it |
| Findings | `FINDING` | maps current `ShadowFinding`; classification remains explicit UNKNOWN |
| Provenance | `PROVENANCE` | requires the complete Phase-3 provenance field set |
| Plans | `PLAN` | maps `ShadowPlan` as `WORK_ORDER` |
| Gates | `GATE` | stable IDs map directly to current `pre_approval` / `pre_execute` guard boundaries |
| Locks | `LOCK` | exposes only current exact-target lock facts; no lock type or TTL is invented |
| Writers | `WRITER` | proposed writer is plan metadata; writer runtime state remains explicit UNKNOWN |
| Agents | `AGENT` | stable identity/runtime shape exists; values remain unavailable until backed by real authority |
| Connectors | `CONNECTOR` | stable connector runtime shape exists; values remain unavailable until backed by real runtime authority |
| Audit | `AUDIT` | exposes chain identity; raw payload is withheld pending explicit UI-safe redaction/relationship modeling |
| Runtime | `RUNTIME` | stable shape exists; unavailable until an authoritative runtime source exists |
| Telemetry | `TELEMETRY` | stable shape exists; unavailable until a verified telemetry source exists |

## Security properties

This patch intentionally does **not**:

- add a frontend dependency;
- add a web endpoint;
- select React, Next.js, Tailwind, Zustand, React Flow, WebSocket or SSE;
- enable a writer;
- mint a capability;
- add an approval path;
- perform a write;
- derive security-sensitive state from `TELEMETRY` or `LOCAL_UI`;
- expose raw Audit payloads as UI-safe data;
- invent lifecycle stages, finding classifications, writer runtime states, agent health, connector health or telemetry values.

## Explicit unknowns retained

Phase 4.2 stabilizes **shape and authority**, not fictional runtime data.

The following remain unavailable until a real backend source exists:

- separate lifecycle stage beyond `OrderStatus`;
- finding classification/state;
- writer runtime state;
- agent identity/health/runtime/activity population;
- connector state/health/auth population;
- generalized runtime state;
- telemetry metrics;
- UI-safe typed Audit payload/relationship model.

The frontend must render these as unavailable/UNKNOWN rather than infer them.

## Acceptance

Phase 4.2 patch acceptance requires:

- exact roadmap source-class vocabulary;
- deterministic mapping from current backend models;
- complete Phase-3 provenance requirement;
- explicit UNKNOWN for unmodeled concepts;
- no raw sensitive Audit payload in the UI contract;
- no frontend dependency or write capability;
- existing regression suite remains green.

After this contract patch is merged and CI remains green, the next frozen-roadmap step is **Phase 4.3 — verify and select the actual frontend stack**.
