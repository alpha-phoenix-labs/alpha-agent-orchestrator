# Phase 4 - Premium Mission Control Visual Contract

Status: **PHASE 4 EXIT-GATE IMPLEMENTATION BASELINE - READ-ONLY UI**

Repository baseline: `main@0de620b054b49894c9bc99ffe36cdc9a3bde1d6f`

This contract translates the user-approved Premium Frontend direction and the two user-provided visual references into a repository-owned implementation target for the Phase 4 Mission Control remediation pass.

It does not reorder the frozen roadmap, introduce Phase 5 controls, replace backend authority, or authorize mock state to masquerade as runtime truth.

## 1. Source hierarchy for this contract

The implementation must preserve this order:

1. current code, current tests and real runtime evidence;
2. frozen integrated roadmap plus approved amendments;
3. existing backend-to-frontend authority contracts and UI safety boundaries;
4. this visual contract for composition, visual hierarchy and product presentation;
5. user-provided visual references as design evidence encoded by this document.

If visual styling conflicts with authority, accessibility, stale/unknown handling, secret redaction or fail-closed behavior, the safety boundary wins.

## 2. Product north star

The Mission Control screen must read as one coherent premium Operations Console, not as a generic admin dashboard and not as an unrelated stack of cards.

The target character is:

- dense but calm;
- dark Obsidian / deep-navy glass surfaces;
- cyan-led operational information with restrained violet flow accents;
- precise, technical, high-contrast typography;
- subtle depth, glow and motion;
- visually dominant live/swarm topology region;
- persistent Control Plane / authority context;
- strong information hierarchy at a glance;
- no decorative effect that can be mistaken for VERIFIED, APPROVED, HEALTHY or WRITE PERMITTED.

The first user reference defines the product composition. The second reference defines the brand atmosphere: futuristic depth, cyan/violet energy, precision, motion and premium technical character. The product UI must use that atmosphere as visual DNA, not as a literal space-scene background.

## 3. Mandatory 1440px desktop master

Primary acceptance viewport: **1440 x 1000**.

At this viewport the Mission Control master must have no horizontal scrolling and must present a coherent three-zone operational layout.

Recommended composition envelope:

- global top bar: approximately 56-64px high;
- left operator/Leader zone: approximately 280-320px;
- central operational zone: flexible and visually dominant;
- right Control Rail zone: approximately 320-360px;
- inter-panel gutters: approximately 12-16px;
- bottom intelligence strip integrated into the same visual system.

These measurements are composition targets, not permission to hide safety-critical content when real labels or values require additional space.

### First-fold priority

The initial 1440 x 1000 view must make the following immediately identifiable:

- product identity and primary navigation;
- authority availability / connection freshness context;
- active Work Order context where available;
- Leader surface;
- Live Swarm Topology hero region;
- permanent Control Rail;
- Agent Grid and Work Order Lifecycle region;
- the beginning or full presentation of Recent Events / Trace / Evidence depending on real content density.

The layout must feel intentionally composed even when authoritative data is unavailable.

## 4. Zone contract

### 4.1 Global Top Bar

**Purpose:** identity, navigation and global operating context.

Must provide:

- product / console identity;
- primary routes already supported by the application;
- authoritative System Mode where available;
- connection / authority availability and freshness state;
- current user / local UI context only when real;
- active context distinction where applicable.

**Authority classes:** `AUTHORITATIVE` plus explicitly separated `LOCAL_UI` presentation state.

Rules:

- never render `Swarm Online`, `HEALTHY`, `LIVE` or equivalent unless a real contract supports that claim;
- `UNKNOWN`, `STALE`, `UNAVAILABLE` and disconnect state must be textual, not color-only;
- no Phase 4 write control may exist here.

### 4.2 Left Leader Surface

**Purpose:** make the Leader the visible orchestration focal point without introducing direct Phase 4 control.

Visual target:

- visually distinct operator/Leader pane;
- conversation/history or orchestration context when authoritative data exists;
- current Leader identity, role, runtime/activity and Work Order relationship where contracted;
- compact status treatment consistent with the rest of the console.

**Authority classes:** `AUTHORITATIVE`, `WORK_ORDER`, `RUNTIME` as provided by contracts.

Phase 4 interaction:

- read-only / drill-down only;
- no operational prompt submission, task assignment, direct agent command, writer activation or approval execution;
- a future input affordance may not appear active if no backend-owned Phase 5 contract exists.

### 4.3 Central Live Swarm Topology Hero

**Purpose:** primary visual representation of the current swarm and its observable relationships.

This is the dominant visual region of Mission Control.

Must support, when backed by real contracts:

- Leader as the visually dominant central node;
- worker/specialist agents as clearly differentiated surrounding nodes;
- relationships / data flow / work-order relationship edges only where the relationship is real;
- role, activity/runtime state and work-order relationship on hover, focus or drill-down;
- pan/zoom/fit behavior if a graph renderer is introduced;
- per-node or per-region rendering failure isolation;
- reduced-motion mode;
- explicit unavailable state when membership or edge contracts do not exist.

**Authority classes:** structural data from `AUTHORITATIVE`; activity overlays may use `RUNTIME` / `TELEMETRY` only when clearly separated.

Safety semantics:

- animated edge != verified;
- glow != approved;
- active node != writer permission;
- pulse != healthy unless health is authoritative;
- telemetry may enrich appearance but may never define security truth.

Implementation guidance:

- an interactive graph library such as `@xyflow/react` is a valid candidate, not a mandatory dependency;
- adopting a graph dependency requires a scoped implementation diff and relevant tests;
- no framework migration is justified for this visual requirement.

### 4.4 Agent Grid

**Purpose:** dense operational scan of current agents.

Must present real fields only, such as where available:

- agent / role;
- health;
- runtime state;
- activity;
- Work Order association;
- latency;
- tokens/second;
- context usage;
- connector;
- block reason.

Missing fields must remain `UNKNOWN` / `UNAVAILABLE`, not be populated with demo values.

**Authority classes:** `AUTHORITATIVE`, `RUNTIME`, `TELEMETRY` with source separation.

No Start/Stop, Assign Task, Change Prompt, Send Command, Enable Writer, Deploy, Approve or Unlock action is permitted in Phase 4.

### 4.5 Work Order Lifecycle

**Purpose:** make the active orchestration stage readable in seconds.

Must show only contracted lifecycle stages and state. Completed/current/future presentation must use text/icon/shape in addition to color.

**Authority class:** `WORK_ORDER`.

A visually highlighted current stage is presentation only and cannot redefine lifecycle truth.

### 4.6 Permanent Control Rail

**Purpose:** persistent safety and authority reference.

This is the highest-priority safety surface in the layout.

Visual order should remain conceptually stable:

1. System Mode;
2. Canonical State;
3. Active Work Order;
4. Gates;
5. Locks;
6. Writers;
7. Blockers;
8. freshness / authority-unavailable context where required.

**Authority class:** `AUTHORITATIVE` / `WORK_ORDER` only as defined by backend contracts.

Rules:

- `UNKNOWN` never becomes PASS;
- telemetry cannot set Gate, Lock, Writer, Blocker, approval or canonical status;
- no active toggles or switches in Phase 4;
- no hidden force action, command-palette write, unlock or deployment shortcut.

### 4.7 Telemetry / Resource / Token Visuals

**Purpose:** compact observability, never authority.

Charts may be introduced only when real telemetry contracts provide the represented measurements.

**Authority class:** `TELEMETRY`.

Rules:

- every visual must remain understandable when telemetry is missing or stale;
- live labels require a real verified live delivery path;
- no invented CPU, RAM, disk, network, latency or token values;
- chart libraries such as Recharts are optional and evidence-driven;
- charts must not crowd out Control Rail authority context.

### 4.8 Recent Events

**Purpose:** compact read-only stream of recent safe operational events.

When real event contracts exist, rows may show safe metadata such as:

- timestamp;
- source;
- agent/role where authoritative;
- Work Order relationship where authoritative;
- event type;
- state/status where authoritative;
- latency where real telemetry exists;
- sanitized metadata.

**Authority classes:** source-class dependent; each event must preserve its source semantics.

No secret-bearing or full sensitive payload may be rendered.

### 4.9 Trace / Waterfall

**Purpose:** temporal observability across Request / Route / Read / Verify / Plan / Human Gate / Execute / Post Verify where those stages actually exist.

The Phase 4 view remains read-only and must not imply that absent later-phase stages executed.

**Authority class:** observability presentation; not canonical Audit truth.

A custom DOM/SVG implementation remains valid; a chart dependency is not required merely for visual polish.

### 4.10 Evidence & Audit Summary

**Purpose:** make source/evidence/audit context immediately inspectable without exposing sensitive payloads.

Must preserve the existing separation between Evidence, Audit and observability.

**Authority classes:** `EVIDENCE` / `AUTHORITATIVE` as provided by contracts.

No frontend verification, finding classification or audit rewriting is allowed.

## 5. Visual system contract

### 5.1 Surfaces

Base environment:

- Obsidian / deep navy base around `#05070A` / `#020617`;
- layered radial gradients may add depth but must remain subtle;
- premium glass panels may use approximately `rgba(15, 23, 42, 0.50-0.65)`;
- backdrop blur approximately 12-18px where performant;
- fine neutral borders approximately `rgba(255,255,255,0.06-0.10)`;
- restrained inner highlight and deep soft shadow;
- corner radius generally 10-16px, consistent across major panels.

No star field, literal space city, decorative planet or cinematic background should reduce readability of the operational UI.

### 5.2 Color roles

Recommended semantic palette:

- cyan: primary operational information / selection / active flow;
- violet: secondary swarm/flow differentiation;
- emerald: positive state only when state is real;
- amber: warning, stale, degraded, unavailable attention;
- crimson/red: failed, critical or denied state where authoritative;
- slate/neutral: inactive, secondary and structural information.

Color never carries status meaning alone.

### 5.3 Typography

- neutral modern sans for interface text;
- monospace for IDs, SHAs, timestamps, latency, token counts, versions and technical values;
- uppercase micro-labels may be used sparingly for panel hierarchy;
- primary values must remain readable under dense 1440px composition;
- decorative letter spacing must not reduce scan speed.

### 5.4 Glow and depth

Glow is a controlled accent, not a default panel treatment.

Allowed examples:

- selected navigation item;
- topology Leader node;
- active but non-authoritative flow visualization;
- focus/hover treatment.

Glow must never be the only indication of approval, health, verification, write permission or gate result.

### 5.5 Motion

Motion should communicate topology/activity continuity, not spectacle.

Requirements:

- subtle and bounded;
- `prefers-reduced-motion` respected globally;
- no flashing or high-frequency pulse;
- disconnect/stale state stops or visually de-emphasizes live activity;
- motion never continues in a way that makes stale data appear current.

A general animation library is optional; CSS/native animation is preferred when sufficient.

## 6. Responsive contract

Desktop master is primary, but safety must survive smaller viewports.

At narrow widths:

- no safety-critical state may be hidden solely to preserve aesthetics;
- Control Rail content remains reachable and semantically grouped;
- horizontal overflow of the complete application shell is not acceptable;
- topology may reduce detail or become vertically stacked, but must not fabricate simpler authority semantics;
- tables/grids may scroll within bounded regions or reflow into cards when necessary;
- keyboard order must remain logical.

Minimum existing validation viewport remains **320 x 800**.

## 7. Data and fixture rules

The production UI remains backend-contract driven.

Development fixtures are permitted only for isolated visual/component development if all of the following hold:

- fixture source is clearly named as fixture/test/demo data;
- fixture mode is visually distinguishable from real runtime;
- fixtures cannot be loaded by normal production authority paths accidentally;
- no fixture value is represented as real Evidence, live Runtime, Canonical State, approval or security state;
- production code continues to fail closed on missing authority.

`MOCK DATA ONLY` is explicitly **not** the product architecture.

## 8. Dependency rules

The existing React + TypeScript + Vite + Tailwind architecture remains authoritative.

This visual contract does not authorize a migration to Next.js or a parallel `src/app` architecture.

Potential additions must be justified by a concrete visual requirement:

- `@xyflow/react`: valid candidate for topology interaction;
- `lucide-react`: valid candidate for consistent iconography;
- Recharts or equivalent: only when real chartable telemetry exists;
- Framer Motion or equivalent: optional; only if CSS/native motion cannot meet the requirement without unnecessary complexity.

Every dependency addition requires normal security/dependency audit and regression validation.

## 9. Phase 4 visual remediation acceptance checklist

The Premium Mission Control remediation is **PASS** only when all applicable items below have evidence:

- [ ] 1440 x 1000 render reads as one coherent Operations Console;
- [ ] no horizontal scroll at 1440px;
- [ ] Leader surface is visually identifiable;
- [ ] Live Swarm Topology is the central visual hero rather than a plain field list;
- [ ] Control Rail is persistent, visually distinct and authority-first;
- [ ] Agent Grid and Lifecycle are readable without dominating the hero region;
- [ ] Recent Events, Trace/Waterfall and Evidence/Audit use one consistent design system;
- [ ] dark/glass/cyan/violet brand language is consistent across the screen;
- [ ] spacing, border, typography and radius tokens are coherent;
- [ ] technical IDs/metrics use monospace treatment consistently;
- [ ] `UNKNOWN`, `STALE`, `BLOCKED`, `FAILED` and `UNAVAILABLE` remain explicit where applicable;
- [ ] no status depends on color alone;
- [ ] no decorative animation/glow implies authority;
- [ ] missing backend fields remain unavailable rather than receiving invented demo values;
- [ ] no Phase 5 operational write control is active or hidden in the Phase 4 interface;
- [ ] 320 x 800 retains safety-critical state and logical navigation;
- [ ] reduced-motion behavior remains valid;
- [ ] rendering failures remain isolated;
- [ ] secret redaction remains intact;
- [ ] tests/build remain green;
- [ ] a human visual review confirms the rendered result matches the encoded product/brand north star.

## 10. Required evidence for visual gate closure

A future implementation PR claiming this visual gate must provide:

1. exact commit SHA;
2. passing frontend unit/component tests;
3. passing production build/typecheck;
4. passing browser E2E at required viewports;
5. rendered screenshot evidence at 1440 x 1000;
6. rendered screenshot evidence at 320 x 800 or equivalent narrow acceptance viewport;
7. explicit confirmation that no mock/fixture state is presented as live authority;
8. explicit confirmation that no Phase 5 write controls were introduced;
9. independent visual review against this contract.

A green test suite without rendered visual evidence is insufficient to close the premium visual quality gate.

## 11. Current baseline gap

At `main@0de620b054b49894c9bc99ffe36cdc9a3bde1d6f`, the frontend already has important safety/accessibility foundations, but the target composition is not yet demonstrated.

In particular, the current Mission Control remains predominantly panel/contract-value based, and the current topology implementation is not yet the visually dominant interactive node/edge hero described here.

Therefore the current visual gate remains **NOT PASSED** until a remediation implementation and render evidence satisfy this contract.
