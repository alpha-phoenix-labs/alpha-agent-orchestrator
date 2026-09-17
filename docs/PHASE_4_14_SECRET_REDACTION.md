# Phase 4.14 - Secret redaction

Status: **READ-ONLY UI REDACTION BOUNDARY**

Baseline: `main@57b891d857d4f78dea1f2fc2ae6ade5e6e97a2c3`

## Roadmap scope

Frozen Roadmap section 7.14 requires the Operations Console to never render:

- API keys;
- bearer tokens;
- cookies;
- private keys;
- raw capability tokens;
- full sensitive payloads.

The roadmap-wide Secret Boundary additionally prohibits these values from UI, Audit, log, telemetry, trace and error surfaces.

## Verified pre-change state

At the baseline above:

- credentialed GitHub and Render read transports already keep provider credentials inside backend transport boundaries and sanitize transport failures;
- Render read policy positively excludes secret-bearing descendants;
- raw Audit payload is already withheld through `RAW_AUDIT_PAYLOAD_NOT_UI_SAFE`;
- the Phase 4 frontend receives backend-owned `OperationsSnapshot` contracts through `OperationsDataProvider`;
- multiple UI components render available contract values with `String(value)` and System / Swarm may serialize object-valued telemetry with `JSON.stringify(value)`;
- no centralized frontend redaction boundary existed before a snapshot was exposed to UI consumers.

Therefore upstream controls reduce secret exposure risk but do not provide a final UI-side fail-closed guarantee if a malformed, future or unexpectedly credential-bearing value reaches an otherwise available view field.

## Implemented boundary

`frontend/src/secret-redaction.ts` adds deterministic presentation sanitization for `OperationsSnapshot` values before the snapshot is exposed through `OperationsDataProvider`.

The sanitizer:

- redacts values under explicitly sensitive field names such as API-key, authorization, cookie, password, private-key and capability-token fields;
- recognizes high-confidence secret-bearing string shapes including bearer credentials, cookie headers, private-key PEM markers, JWT-shaped values, common credential token prefixes and explicit secret assignments;
- recursively sanitizes object and array values, including telemetry metric objects;
- preserves nested `ViewContract` / `ViewField` structure so source class, availability and contract semantics are not reinterpreted;
- sanitizes secret-bearing unavailable-reason strings as a defensive error-surface boundary;
- preserves non-secret metadata such as `capability_id`, state identifiers, SHA values, latency and `tokens_per_second` unless their actual string content itself matches a secret-bearing pattern;
- returns `[REDACTED]` rather than exposing the original secret-bearing value.

## Authority and state-drift ordering

Phase 4.13 state-drift evaluation still uses the raw authoritative state version internally for equality/drift decisions. Redaction is applied only after that decision and before values become available to UI consumers.

This prevents redaction from becoming a new source of backend authority while ensuring that a secret-looking current/viewed state-version value is not rendered in the State Context strip.

`currentSnapshot` and the active domain `snapshot` exposed by `OperationsDataProvider` are both sanitized copies. The original input snapshot is not mutated.

## Existing controls retained

This patch does not replace or weaken upstream controls:

- raw Audit payload remains unavailable;
- backend transport credential ownership remains unchanged;
- Render secret-path exclusions remain unchanged;
- `TELEMETRY != AUTHORITY` remains unchanged;
- redaction does not create verification, approval, policy, lock, capability validity, Writer or write-eligibility authority;
- no live transport, reconnect behavior, historical data contract or Phase 4.15 accessibility work is introduced.

## Validation target

Tests must prove that:

- sensitive field names are redacted;
- non-secret token metrics and capability IDs remain displayable;
- bearer, cookie, private-key, JWT and explicit credential-assignment strings are redacted;
- nested telemetry/object values cannot expose secret-bearing members;
- nested `ViewContract` structure survives sanitization;
- both `snapshot` and `currentSnapshot` are sanitized before UI access;
- state-drift evaluation can still compare raw versions while rendered versions are redacted;
- existing backend, frontend, browser and read-only runtime validation remain green.

## Non-scope

No backend runtime path, Render read proxy, production configuration, provider secret, deployment, write capability or infrastructure state is changed by Phase 4.14.
