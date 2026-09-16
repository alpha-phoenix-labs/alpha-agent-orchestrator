# Phase 4.13 - State drift and historical-state separation

Status: **READ-ONLY STATE-SEPARATION BOUNDARY**

Baseline: `main@ce930956560dc097e659f781671409d535894d5b`

## Roadmap scope

Frozen Roadmap section 7.13 requires:

- viewed state and current state to remain distinguishable when displayed state changes while a view remains open;
- stale context to be explicit;
- refresh/resync to avoid silently combining historical and current data;
- backend-reported Approval invalidation to be visible;
- historical views to clearly distinguish historical state from current live system state.

## Verified contract state

At the baseline above:

- `SYSTEM_STATE.state_version` is an authoritative backend view field and can identify the current Control Plane state version;
- Work Orders and Plans expose their own backend-owned `base_state_version`, but the frontend has no contract declaring either field to be a generic historical snapshot;
- no backend `APPROVAL` view contract exists in the Phase 4 view-contract set;
- core approval/state binding exists in backend security logic, but that core behavior is not promoted into frontend authority without a dedicated view contract;
- no backend historical-snapshot view contract exists;
- no verified live WebSocket/SSE transport or automatic snapshot refresh endpoint exists;
- Phase 4.12 already suppresses retained data when connection/snapshot authority is stale or requires resync.

Therefore Phase 4.13 must not invent historical domain records, approval invalidation state, a refresh endpoint or a local security verdict.

## Implemented state-context model

`frontend/src/state-drift.ts` introduces a deterministic presentation-only state-context model.

A managed live view has an explicitly supplied `viewedStateVersion`, representing the authoritative state version to which that open view is bound. The model compares that binding only with the current backend-reported `SYSTEM_STATE.state_version`.

Possible presentation statuses are:

- `CURRENT` - viewed and current state versions match;
- `STALE` - both versions are known and differ;
- `UNKNOWN` - the view is managed but the current state version is unavailable, or no viewed-state binding has been supplied;
- `HISTORICAL` - the caller explicitly declares historical-view mode.

This comparison is **LOCAL_UI presentation context only**. It does not declare Plan validity, approval validity, write eligibility, Evidence freshness, policy outcome or any other security-sensitive state.

## Fail-closed snapshot presentation

`OperationsDataProvider` now keeps two concepts separate:

- `currentSnapshot`: the currently authoritative live snapshot after the Phase 4.12 connection/freshness boundary;
- `snapshot`: the snapshot permitted to be exposed to the active domain view.

Rules:

1. If no viewed-state binding is supplied in normal live mode, existing Phase 4 behavior remains compatible.
2. If a managed live view's viewed/current versions match, the current snapshot may be presented.
3. If the versions differ, the view becomes `STALE` and the current snapshot is withheld from domain components.
4. If a managed viewed state exists but current state version is unavailable, the view fails closed and withholds the current snapshot.
5. In `HISTORICAL` mode, the current live snapshot is never substituted into the historical view.

The provider retains `currentSnapshot` separately so the shell can show the current live context while domain content remains withheld. This prevents silent mixing of old view context with current domain data.

## Visible separation

When state-context management is active, the App Shell renders a dedicated read-only `STATE CONTEXT` strip with:

- view mode;
- viewed state version;
- current state version;
- context status and reason;
- Approval invalidation availability.

For a version mismatch the UI exposes `STALE · STATE_VERSION_DRIFT` while the domain snapshot is withheld.

For historical mode it exposes `HISTORICAL · HISTORICAL_VIEW_CURRENT_SNAPSHOT_SEPARATED`; current live canonical context remains separately visible in the existing Active Context Bar.

## Approval invalidation boundary

Phase 4.13 does **not** infer approval invalidation from:

- state-version drift;
- gate state;
- Work Order status;
- Plan fields;
- telemetry;
- local UI state.

Because no backend `APPROVAL` view contract currently exists, the state-context strip reports:

`UNAVAILABLE · NO_APPROVAL_VIEW_CONTRACT`

This preserves the roadmap rule that only backend-reported Approval invalidation may be shown as approval authority.

## Historical-data boundary

This patch does not manufacture historical domain data.

`HISTORICAL` mode deliberately withholds the current live snapshot. A future historical view must be backed by an explicit backend-owned historical snapshot/record contract before historical domain content can be rendered.

This is stricter than reusing the current snapshot with a historical label and prevents current data from visually masquerading as historical state.

## Refresh / resync boundary

No refresh button, network request or snapshot endpoint is added because no verified live transport or authoritative snapshot-refresh endpoint exists.

Phase 4.12 resync semantics remain intact. Phase 4.13 adds the rule that a managed stale view cannot silently adopt the current snapshot. A future real refresh/resync integration must explicitly rebind the view to the newly authoritative state version.

## Security boundaries retained

- `TELEMETRY != AUTHORITY`;
- `LOCAL_UI` state drift != backend security state;
- state-version mismatch != approval invalidation;
- state-version match != write eligibility;
- historical label != historical backend data;
- no Evidence verification or Finding classification is added;
- no policy, lock, capability, Writer, approval, execution, deploy or mutation control is added.

## Validation target

Tests must prove:

- matching viewed/current versions permit a managed live snapshot;
- a version mismatch is explicit and suppresses current domain presentation;
- missing current state version fails closed for a managed view;
- historical mode never substitutes current live domain data;
- unmanaged existing live snapshot behavior remains compatible;
- approval invalidation remains unavailable rather than inferred;
- the shell visibly separates viewed and current versions during drift.

No backend runtime file, Render read-proxy path, production configuration, secret or write capability is changed by this patch.
