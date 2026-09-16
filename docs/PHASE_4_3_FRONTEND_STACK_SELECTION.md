# PHASE 4.3 — Frontend Stack Verification and Selection

Status: **STACK SELECTED — NO FRONTEND IMPLEMENTATION**

Baseline: `main@556a6399633ea91b6e31b3025f714e3cbb7c9a14`

## Purpose

This document executes frozen-roadmap section **7.3 — Verify and select the actual frontend stack**.

It does not start Phase 4.4. No frontend project, dependency lockfile, application shell, endpoint, streaming transport, writer control, deployment target or production runtime is created here.

## Verified repository baseline

The repository was inspected again after Phase 4.2 merged.

Confirmed at the baseline above:

- the repository is a Python package driven by `pyproject.toml`;
- Python requires `>=3.11`;
- the project currently declares no runtime Python dependencies and `pytest>=8.0` as its development dependency;
- the recursive repository tree contains no `package.json`;
- the recursive repository tree contains no `.tsx`, `.jsx` or `.html` application files;
- no existing frontend directory or established JavaScript/TypeScript frontend stack is present;
- Phase 4.2 now provides backend-owned read/view contracts and explicit source-of-truth metadata for later UI consumption.

Therefore there is no existing frontend framework to preserve or migrate.

## Verified product requirements relevant to stack choice

The frozen roadmap requires the first Operations Console to support, over subsequent Phase-4 steps:

- a persistent application shell and routing;
- Mission Control, Work Orders, Evidence & Audit, and System / Swarm views;
- strict rendering of backend authority rather than frontend-derived security truth;
- complex read-only state presentation;
- later topology/graph visualization;
- later trace/waterfall and telemetry views;
- later live event ingestion with schema validation, ordering/gap handling and resync semantics;
- explicit stale / UNKNOWN / authority-unavailable presentation;
- keyboard accessibility, visible focus, reduced motion and non-color-only status semantics.

The separate UI concept is treated as product/design input only. Its references to React/Next.js, Tailwind, Zustand, React Flow, WebSocket/SSE and related libraries are candidates, not prior repository facts.

## Selected Phase-4 frontend foundation

### Application model

**Client-side single-page Operations Console.**

Rationale:

- this is an authenticated/internal control-plane console, not a public content or SEO surface;
- current requirements do not justify server-side rendering or a separate full-stack JavaScript server;
- the authoritative backend remains the Python control plane;
- keeping the frontend as a separate client reduces accidental duplication of backend authority.

### Core framework

**React + TypeScript + Vite.**

Selection rationale:

- React fits the required component-heavy operational UI, nested detail surfaces, graph views and later live state updates;
- TypeScript is required for explicit frontend contract types and safer handling of authoritative/unavailable field states;
- Vite provides the smallest responsible build/dev layer for a client-only application without introducing Next.js server/runtime semantics that are not currently required.

### Routing

**React Router.**

Reason:

- Phase 4.4 requires explicit navigation/routing across the four primary product areas;
- a dedicated router is clearer and safer than ad-hoc URL handling;
- no server-side route loader model is required at this point.

### Styling

**Tailwind CSS, with repository-owned design tokens and accessibility rules.**

Reason:

- the product requires a dense, highly structured operations-console visual system with repeated spacing, state, focus, reduced-motion and responsive rules;
- Tailwind is suitable for enforcing those patterns without introducing a runtime CSS-in-JS layer;
- design semantics remain repository-owned; Tailwind utilities do not become a source of domain truth.

### Testing

**Vitest + React Testing Library + user-event.**

Reason:

- frontend behavior must be testable independently from the Python backend;
- tests must validate rendering of authority classes, UNKNOWN/stale behavior, keyboard interaction and safety-critical visibility;
- this keeps generator and evaluator concerns separable and allows CI to fail closed on regressions.

### Package manager

**npm with a committed lockfile.**

Reason:

- no JavaScript package manager currently exists in the repository;
- npm is the smallest default choice with standard Node distributions and GitHub-hosted CI runners;
- the lockfile will pin the actual dependency graph when Phase 4.4 initializes the frontend.

### Node runtime

**Node.js 24 LTS for the initial frontend toolchain.**

Reason:

- the current CI environment already demonstrates Node 24 availability;
- one pinned LTS line avoids environment drift;
- the exact engine declaration and CI setup belong to Phase 4.4 when the frontend is actually created.

## Explicitly not selected yet

The following candidates are intentionally deferred because the frozen roadmap assigns their decision to later evidence or later Phase-4 work:

### Next.js

**Not selected for V1 foundation.**

There is currently no confirmed requirement for SSR, React Server Components, edge/server routes, SEO rendering or a separate JavaScript backend. Introducing those semantics would increase runtime and deployment surface without confirmed benefit.

### Zustand

**Deferred.**

Phase 4.4 should begin with React state/context around the explicit backend view contracts. Add an external client state store only if real cross-view state complexity justifies it. Security-sensitive truth must still originate from backend contracts, never the store itself.

### React Flow / Cytoscape.js / WebGL

**Deferred to Phase 4.9 — Live topology and Agent Grid.**

The current topology requirement is real, but the correct renderer depends on verified node/edge volume, interaction needs and accessibility/performance behavior. No graph dependency is installed early.

### Dagre / ELK

**Deferred with topology implementation.**

No layout engine is needed before a graph renderer and real topology schema exist.

### shadcn/ui / other component kits

**Not selected as a foundation dependency.**

Phase 4.4 should first establish repository-owned shell primitives and accessibility behavior. Individual headless/component primitives may be added later only where they reduce risk or duplication.

### Lucide React

**Deferred until Phase 4.4 component implementation.**

Icons are presentation-only and can be added when there is a concrete use. Status meaning must never depend on icon or color alone.

### WebSocket vs SSE

**Intentionally unresolved until Phase 4.11.**

The roadmap explicitly requires transport selection only after event requirements are verified. Phase 4.3 does not choose a live transport.

### Redis / PubSub / multiplexed gateway / delta compression

**Not selected.**

No current scale or topology evidence requires these components. They remain deferred unless later runtime evidence justifies them.

## Security and authority boundary

The selected frontend stack does not change the control-plane security model.

Mandatory rules remain:

- backend model -> UI model, never UI model -> backend authority;
- `TELEMETRY != AUTHORITY`;
- `LOCAL_UI` cannot satisfy an authoritative field;
- security-sensitive state is rendered from Phase-4 view contracts only;
- UNKNOWN/unavailable remains explicit;
- no direct writer, deploy, merge, unlock, force-approval or force-execution shortcut is introduced;
- no credential-bearing payload is a frontend display requirement;
- frontend local state may own presentation state only.

## Phase 4.4 implementation boundary

The next roadmap phase may initialize the selected stack and build the common application shell. The smallest responsible first implementation should therefore create only what Phase 4.4 requires:

- a frontend project directory;
- React + TypeScript + Vite;
- React Router;
- Tailwind CSS;
- Vitest + React Testing Library + user-event;
- npm lockfile;
- Node engine/toolchain pin;
- global shell primitives;
- primary navigation;
- Active Context Bar;
- error isolation;
- a basic typed data/state boundary that consumes backend-owned view-contract shapes without inventing domain state.

Graph libraries, live transport, external state stores and advanced visualization dependencies remain outside that first diff unless Phase 4.4 evidence makes them strictly necessary.

## Acceptance result

Phase 4.3 is satisfied when this decision is merged with green CI because:

- the repository was re-inspected after Phase 4.2;
- absence of an existing frontend stack is confirmed;
- current dependencies were confirmed;
- the smallest responsible frontend foundation was selected;
- major candidate technologies were explicitly selected, rejected or deferred against verified project needs;
- no frontend implementation or premature dependency installation occurred;
- the next execution pointer remains Phase 4.4 — App shell.
