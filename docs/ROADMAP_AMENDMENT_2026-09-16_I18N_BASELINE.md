# Roadmap Amendment - 2026-09-16 - Internationalization & Localization Baseline

Status: **USER-APPROVED SCOPE - DEVELOPMENT BRANCH IMPLEMENTATION**  
Amendment ID: `ROADMAP-AMENDMENT-I18N-001`  
Applies to: `docs/INTEGRATED_ROADMAP.md`  
Base roadmap status: frozen/binding  
Repository baseline: `main@febf6cb823aefbe194d0d6b6fdd22a05716c74c4`

Insertion point: **after Phase 4.10 - Trace / Waterfall and before Phase 4.11 - Live event ingestion and schema safety**.

This amendment does not renumber, remove, weaken or reorder any existing roadmap phase.

## 1. Reason

The Phase-4 Operations Console has been implemented through Phase 4.10. The current frontend already contains presentation text across App Shell, Mission Control, Work Orders, Evidence & Audit, System / Swarm, Live Topology / Agent Grid and Trace / Waterfall.

Internationalization was approved after those surfaces were built. Continuing into Phase 4.11 and later resilience/safety work without first introducing a localization boundary would increase presentation-text coupling and make later localization more invasive.

This amendment therefore inserts one bounded localization-foundation gate before Phase 4.11.

The amendment changes presentation architecture only. It does not create write capability, change Control Plane authority, change Human Gate semantics, change Evidence verification, change Finding classification, calculate Freshness or Risk, change approval validity, change locks or policies, select a live transport, or alter Phase 4.11 event semantics.

## 2. V1 language baseline

Official V1 supported locales:

- `de-DE`
- `en-US`

Architecturally anticipated but not V1-supported by this amendment alone:

- `en-GB`
- `fr-FR`
- `es-ES`

Likely first expansion candidates are `fr-FR` and `es-ES`. Any additional locale must pass the same acceptance contract before it is exposed as `SUPPORTED`.

## 3. Language dimensions

The product keeps three concepts logically separate:

- `interfaceLocale`
- `conversationLanguage`
- `outputLanguage`

`interfaceLocale` controls presentation owned by the software UI, including navigation, buttons, labels, tooltips, dialogs, accessibility labels and locale-aware formatting.

`conversationLanguage` represents the user's preferred interaction language with the Leader.

`outputLanguage` represents the preferred language for generated user-facing outputs where such translation/generation is explicitly supported.

The three values must not be silently collapsed into one value. This amendment requires `interfaceLocale` support for V1. `conversationLanguage` and `outputLanguage` remain product contracts and must not be faked where the current runtime does not expose a corresponding capability.

## 4. Authority invariant

`LOCALIZATION != AUTHORITY`.

Localization changes presentation only.

The following equivalences are forbidden:

- Display String == Domain State
- Translation == Evidence
- Translation == Verification
- Translation == Approval
- Translation == Freshness
- Translation == Policy Decision
- Translation == Write Eligibility
- Telemetry == Authority

The mandatory direction is:

`backend/control-plane value -> explicit UI semantic mapping -> translation key -> localized presentation`

The frontend must never infer backend state from localized text.

## 5. Backend vocabulary boundary

Confirmed backend concepts remain authoritative. In particular, `SystemMode`, `writes_enabled` and write eligibility remain distinct concepts. `WRITE_ENABLED` must not be invented as a `SystemMode`.

Translation catalogs may contain presentation keys for verified backend values, but catalogs do not define backend vocabulary.

Unknown or unavailable backend concepts remain explicit and are never converted into synthetic UI truth merely to complete a translation surface.

## 6. Evidence, Findings and Audit integrity

Original Evidence content and identity remain unchanged. Any future translated Evidence is additional presentation only and must never replace the original, change verification, change Freshness, change provenance, resolve a conflict, or change Finding classification.

Audit identifiers, hashes, sequence identities, timestamps, state versions and canonical machine values remain unchanged. Localized labels and human-readable explanations must not be used to reconstruct Audit authority.

Finding classification, when backend-owned, is not changed by translation.

## 7. Phase-4 / Phase-5 separation

This amendment remains inside the Phase-4 read-only boundary.

Allowed:

- localized display labels;
- localized read-only descriptions;
- localized status presentation;
- localized accessibility labels;
- locale switching as local presentation state;
- locale-aware date/number formatting where explicitly applied without changing canonical values.

Not allowed:

- approval execution;
- writer activation;
- capability issuance;
- deploy/merge controls;
- force unlock/force approval controls;
- policy override controls;
- any other write-capable behavior.

Existing Phase-5 action semantics remain deferred.

## 8. Critical localization

Safety-, authority-, approval-, lock-, gate-, policy- and write-eligibility-related presentation is critical.

For a missing critical translation:

`requested locale -> en-US fallback -> LOCALIZATION_ERROR if the English baseline is also unavailable`

A translation failure must never hide the canonical technical state, Freeze, Blocker, Approval state, lock/gate state or policy denial.

## 9. UNKNOWN and unavailable states

Domain `UNKNOWN` and missing translation are different conditions.

A domain `UNKNOWN` value remains a real domain/presentation state. A missing translation is a localization error and follows the fallback contract.

Machine reason codes such as `NO_ROUTE_STAGE_CONTRACT` remain stable technical identities and are not rewritten as domain state by the localization layer.

## 10. Technical identities that remain untranslated

The following stay canonical unless a later explicit contract says otherwise:

- Work Order IDs;
- Evidence IDs/references;
- Finding IDs;
- Audit IDs/event sequence identities;
- Execution IDs;
- Agent IDs;
- Connector IDs;
- Capability IDs;
- SHA/hash values;
- Plan Hash;
- State Version;
- repository names;
- branch names;
- paths and URLs;
- machine error/reason codes;
- raw canonical backend values carried in state/transport objects.

## 11. Locale formatting

Date, time, number, percentage and currency presentation may use locale-aware formatter functions. Canonical stored values remain unchanged.

Formatter configuration is not ordinary translated text and must not become a source of domain truth.

## 12. Implementation baseline

At the approved baseline, the frontend stack is React + TypeScript + Vite with React Router, Tailwind CSS, Vitest, React Testing Library and npm.

The smallest responsible localization implementation should avoid changing backend contracts or adding unrelated dependencies. The implementation may use repository-owned typed catalogs/context if that satisfies the acceptance contract without introducing additional runtime surface.

## 13. Language-pack states

A locale may be treated as:

- `DRAFT`
- `VALIDATING`
- `SUPPORTED`
- `NOT_SUPPORTED`

A locale is `SUPPORTED` only after all MUST acceptance gates pass.

## 14. Acceptance contract

For both `de-DE` and `en-US`, the implementation must demonstrate:

1. required-key completeness;
2. DE/EN key parity;
3. critical-key completeness;
4. deterministic fallback to `en-US`;
5. explicit failure if the critical English baseline is absent;
6. placeholder/interpolation parity;
7. pluralization behavior where used;
8. locale switching without domain-state mutation;
9. Evidence/Audit identities unchanged by locale switching;
10. domain `UNKNOWN` distinct from a missing translation;
11. locale-aware formatter behavior where used;
12. accessibility labels present in both supported locales;
13. all current Phase-4 routes render in `en-US`;
14. all current Phase-4 routes render in `de-DE`;
15. critical text remains visible under long-string/zoom pressure;
16. no Phase-5 operational controls are introduced;
17. production frontend build succeeds;
18. full frontend regression remains green;
19. backend regression remains green.

## 15. Explicit non-goals

This amendment does not pull Phase 4.11 forward. It does not select WebSocket, SSE or another live transport, add event ingestion, invent sequence numbers, implement snapshot/resync, add event-authority semantics, or change malformed-event handling.

It also does not implement `conversationLanguage` or `outputLanguage` beyond documenting their separation from `interfaceLocale` unless a separate runtime contract exists.

## 16. Exit and execution pointer

This localization gate is complete only when the implementation is reviewed with green relevant CI and the supported locales satisfy the acceptance contract.

After this gate closes, the execution pointer returns to the frozen roadmap at:

**Phase 4.11 - Live event ingestion and schema safety**.

No merge to `main`, deploy or production action is authorized by this amendment without a separate Human Gate.
