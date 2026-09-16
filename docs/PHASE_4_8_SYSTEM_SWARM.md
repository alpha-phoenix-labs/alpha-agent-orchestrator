# PHASE 4.8 — System / Swarm

Status: **PATCH PREPARED — READ-ONLY SYSTEM / SWARM**

Baseline: `main@450b15a04fc9e2b3bd52200781c6ab9c95599461`

## Purpose

Implement frozen-roadmap Phase 4.8 as a read-only system and swarm view without introducing new runtime authority, policy authority, agent control, write capability or inferred health semantics.

Required surfaces:

- System Overview;
- Agents;
- Connectors;
- Locks;
- Policies where backed by real data;
- Control Plane;
- System Health.

The roadmap requires Agent state to keep Health, Runtime State, Activity and Telemetry semantically separate. Activity such as `THINKING` must not be treated as Health or permission state.

## Contract audit result

The existing Phase 4.2 contracts support only part of the requested surface with current authority.

| Surface | Current backing | Phase 4.8 behavior |
|---|---|---|
| System Overview | `SYSTEM_STATE`, `CANONICAL_STATE` | Display backend-owned mode, write flag, state version and canonical repository facts when present. |
| Agents | `AGENT` shape exists | Display only supplied Agent contracts. Missing identity, Health, Runtime State or Activity stays explicit `UNKNOWN`; no per-Agent Telemetry contract exists. |
| Connectors | `CONNECTOR` shape exists | Display only supplied Connector contracts. Missing state, Health or auth state stays explicit `UNKNOWN`. |
| Locks | `LOCK` | Display exact backend lock facts; no lock type, TTL or unlock capability is invented. |
| Policies | No `POLICY` view contract | Explicit `NO_POLICY_VIEW_CONTRACT`. Repository config is not promoted into runtime or security authority. |
| Control Plane | `SYSTEM_STATE`, `GATE` | Display mode, write flag and backend gate decisions only. |
| System Health | `RUNTIME`, `TELEMETRY` shapes exist | Display supplied runtime/telemetry facts while keeping aggregate health explicit `NO_AGGREGATE_SYSTEM_HEALTH_CONTRACT`. |

The frontend snapshot type is extended only to carry the already-defined backend contract classes needed by this surface: `agents`, `connectors`, `runtime` and `telemetry`.

## Authority rules

Phase 4.8 preserves the Phase 4.2 source-of-truth classes. In particular:

- Agent identity and role are not inferred from static UI labels;
- Agent Health, Runtime State and Activity are not derived from each other;
- global Telemetry is not re-labeled as per-Agent Telemetry;
- Connector Health or auth state is not inferred from connector presence;
- policy configuration files are not treated as an authoritative UI policy-state contract;
- Runtime or Telemetry is not promoted into an aggregate System Health verdict;
- Gate denials or lock presence are not reclassified as health state.

Missing authority remains visible as `UNAVAILABLE` / `UNKNOWN` with an explicit reason.

## Read-only boundary

The System / Swarm surface introduces no operational controls. It does not provide:

- START AGENT;
- STOP AGENT;
- SEND COMMAND;
- ASSIGN TASK;
- CHANGE PROMPT;
- ENABLE WRITER;
- OVERRIDE POLICY;
- FORCE UNLOCK;
- FORCE DEPLOY;
- FORCE APPROVAL.

No button or textbox is introduced by the Phase 4.8 surface.

## Deferred scope

Frozen-roadmap Phase 4.9 live topology and Agent Grid work is not pulled forward. This patch does not add:

- React Flow, Cytoscape, WebGL or another topology dependency;
- WebSocket or SSE transport;
- runtime activity edges;
- latency or tokens/s presentation unless a later verified contract backs it;
- new backend Agent, Connector, Runtime, Telemetry or Policy authority.

## Validation target

Before merge:

- existing backend regressions remain green;
- existing frontend regressions remain green;
- focused Phase 4.8 tests remain green;
- production frontend build succeeds;
- all seven required Phase 4.8 surfaces remain visible when authority is unavailable;
- Agent Health, Runtime State, Activity and Telemetry remain distinct;
- Policies remain unavailable without an explicit policy view contract;
- aggregate System Health remains unavailable without an aggregate health contract;
- empty backend collections are not populated with synthetic records;
- no operational control is introduced.

## Runtime status

This patch can become **CI VERIFIED** after pull-request CI passes. Component tests and a production frontend build do not by themselves establish external frontend runtime verification.

The patch does not change `scripts/render_read_proxy_server.py`, `src/alpha_orchestrator/render_read_proxy.py`, or their dependencies. Therefore it does not require a Render deploy for Phase 4.8 validation.
