# Phase 4.15 - Accessibility and safety UX

Status: **READ-ONLY FRONTEND ACCESSIBILITY / SAFETY BOUNDARY**

Baseline: `main@58cdfa88d63bdf1e50e36aa7fc08938627dcd12b`

## Roadmap scope

Frozen Roadmap section 7.15 requires:

- keyboard navigation;
- visible focus state;
- reduced-motion handling;
- screen-reader labels;
- status never communicated by color alone;
- explicit UNKNOWN state;
- persistent presentation of Freeze, Blocker and other critical states.

The approved Premium Frontend Acceptance amendment additionally requires responsive safety-state preservation, explicit UNKNOWN / STALE / BLOCKED / FAILED / UNAVAILABLE presentation where applicable, panel/node/component rendering isolation, and coherent desktop-master behavior around 1440px.

## Verified pre-change state

At the baseline above:

- primary navigation and locale controls are native keyboard-operable controls with visible `focus-visible` treatment;
- the App Shell, Active Context Bar, State Context Bar and domain panels already expose semantic labels/landmarks;
- UNKNOWN and UNAVAILABLE are rendered as text, not represented only by color;
- the global stylesheet already honors `prefers-reduced-motion: reduce` by bounding animation and transition duration;
- responsive layout classes keep Active Context and State Context in the document flow rather than hiding them at narrow widths;
- Mission Control keeps a persistent Blockers panel, but the current backend view-contract set has no authoritative Blocker contract, so the panel correctly remains UNAVAILABLE instead of inferring blocker state;
- no authoritative Phase 4 Freeze control/state contract exists for the read-only frontend; Phase 4.15 therefore must not invent one;
- the existing `ShellErrorBoundary` prevented a routed rendering failure from collapsing the global header/context shell, but Mission Control panel failures and sibling Evidence/Trace surface failures were not independently isolated.

## Implemented delta

The smallest responsible Phase 4.15 delta is limited to rendering fault isolation and validation of the already-present accessibility/responsive controls:

- `ShellErrorBoundary` now exposes an explicit textual `FAILED` status in its alert fallback;
- every current routed console surface is wrapped in its own isolated rendering boundary;
- Evidence & Audit and Trace / Waterfall are isolated independently so failure in one does not remove the sibling surface;
- Mission Control panel bodies are individually isolated while panel titles and the rest of Mission Control remain available;
- error boundaries deliberately do not emit raw rendering payloads or derive any Control Plane state from frontend failure;
- no approval, Writer, capability, policy, lock, Freeze or execution authority is introduced.

## Validation target

Validation must prove:

- all current console routes still render without client errors or operational write controls;
- primary navigation remains keyboard reachable;
- keyboard focus has visible styling;
- reduced-motion preference bounds transition duration;
- Active Context remains visible and textual at both narrow/mobile-width and 1440px desktop layouts;
- UNKNOWN / UNAVAILABLE remain explicit on the fail-closed no-snapshot baseline;
- a synthetic rendering failure produces an explicit `FAILED` alert while a sibling surface remains rendered;
- existing backend/frontend tests and production build remain green.

## Deferred / not applicable without contracts

- Real Freeze state remains UNKNOWN / not applicable until a backend-owned contract exists. No frontend inference is permitted.
- Real Blocker state remains unavailable until the backend publishes an authoritative Blocker contract. Gate denial, lock state and telemetry are not reclassified as blockers.
- Specialized topology-node isolation for a future graph renderer remains bounded by the real topology implementation. Current topology is static read-only presentation without an external graph renderer.
- Performance/load acceptance such as virtualization and telemetry coalescing remains Phase 6.4 unless real scale evidence makes it applicable earlier.

## Non-scope

No backend runtime path, live transport, Render deployment, production configuration, secret, write capability, Human Gate behavior or infrastructure state is changed by Phase 4.15.
