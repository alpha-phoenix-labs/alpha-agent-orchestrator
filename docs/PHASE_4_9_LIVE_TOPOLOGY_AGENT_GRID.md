# PHASE 4.9 — Live topology and Agent Grid

Status: **PATCH PREPARED — READ-ONLY TOPOLOGY / AGENT GRID**

Baseline: `main@5e22b0d223ddcf5281be0c4d4b0733aacc0f97f4`

## Purpose

Implement frozen-roadmap Phase 4.9 without inventing topology relationships, worker membership, Work Order association or per-Agent telemetry that the current backend contracts do not supply.

Required roadmap concepts:

- Leader node;
- worker nodes;
- runtime activity edges;
- Agent Grid;
- Work Order association;
- latency;
- tokens/s where real telemetry exists;
- context usage where real telemetry exists.

The roadmap safety semantics remain binding:

- animated edge != verified;
- glow != approved;
- active agent != write permitted.

## Contract audit result

Current backend/frontend contracts support only part of the Phase 4.9 target.

| Phase 4.9 concept | Current backing | Phase 4.9 behavior |
|---|---|---|
| Leader node | optional `leader` AGENT view supplied by backend snapshot | Render only when the backend explicitly supplies it. No Agent is promoted to Leader from role, position or Activity. |
| Worker nodes | no explicit worker-membership relationship | Show `NO_EXPLICIT_WORKER_MEMBERSHIP_CONTRACT`. Existing AGENT contracts may be displayed as unclassified Agent nodes, not asserted as workers. |
| Runtime activity edges | no edge/relationship contract | Show `NO_RUNTIME_ACTIVITY_EDGE_CONTRACT`. No edge is created or animated from co-occurrence, Activity, Audit or Telemetry. |
| Agent Grid | `AGENT` contracts | Display supplied identity, role, Health, Runtime State and Activity fields only. |
| Work Order association | no Agent-to-Work-Order relationship contract | Show `NO_AGENT_WORK_ORDER_ASSOCIATION_CONTRACT`. |
| Latency | no per-Agent latency contract | Show `NO_PER_AGENT_LATENCY_CONTRACT`. |
| tokens/s | no per-Agent token-rate contract | Show `NO_PER_AGENT_TOKENS_RATE_CONTRACT`. |
| Context usage | no per-Agent context-usage contract | Show `NO_PER_AGENT_CONTEXT_USAGE_CONTRACT`. |
| Global Telemetry | `TELEMETRY` contract exists | Never redistribute global metrics across Agent rows or use them to infer per-Agent metrics. |

## Implementation boundary

The existing System / Swarm view is extended with two read-only panels:

- `Live Topology`;
- `Agent Grid`.

No new frontend dependency is required. The topology is deliberately a structured read-only representation rather than a React Flow, Cytoscape, WebGL or canvas graph because the repository currently lacks authoritative topology-edge contracts.

Visual placement and grouping are presentation-only. They carry no verification, approval, execution, health or write semantics.

## Authority rules

This patch does not:

- infer Leader identity from `role=LEADER`;
- infer worker membership from any Agent role;
- infer an edge because two Agents are present simultaneously;
- infer an edge from Audit, Activity or Telemetry;
- map global Telemetry onto individual Agents;
- infer Agent-to-Work-Order association from unrelated Work Order collections;
- synthesize latency, token rate or context usage;
- treat `THINKING`, `ROUTING` or another Activity as Health or permission state;
- treat node emphasis, grouping or future animation as verified or approved state.

Missing authority remains explicit as `UNAVAILABLE` / `UNKNOWN` with stable reasons.

## Read-only boundary

Phase 4.9 introduces no operational controls and no write path. It does not add:

- START/STOP AGENT;
- SEND COMMAND;
- ASSIGN TASK;
- CHANGE PROMPT;
- ENABLE WRITER;
- OVERRIDE POLICY;
- FORCE UNLOCK;
- FORCE DEPLOY;
- FORCE APPROVAL;
- drag-to-rewire or other topology mutations;
- WebSocket/SSE transport;
- backend runtime mutations.

No button or textbox is added by this phase.

## Deferred scope

Phase 4.10 Trace / Waterfall and Phase 4.11 live event ingestion/schema safety are not pulled forward.

A later richer topology may only add real activity edges, latency, tokens/s or context usage after backend contracts provide the required identity and source-class semantics. A transport such as WebSocket or SSE must not be selected merely to make this UI appear live.

## Validation target

Before merge:

- existing backend regressions remain green;
- existing frontend regressions remain green;
- focused Phase 4.9 tests remain green;
- production frontend build succeeds;
- Live Topology and Agent Grid remain visible without authority;
- Leader is rendered only from an explicitly supplied backend Leader view;
- worker membership remains explicit unavailable without a relationship contract;
- runtime activity edges remain explicit unavailable without an edge contract;
- Work Order association remains explicit unavailable;
- per-Agent latency, tokens/s and context usage remain explicit unavailable;
- global Telemetry is not displayed as per-Agent telemetry;
- empty Agent collections do not synthesize nodes;
- no operational control is introduced.

## Runtime status

This patch can become **CI VERIFIED** after pull-request CI passes. Component tests and a production frontend build do not establish external frontend runtime verification.

The patch changes only frontend presentation/tests and documentation. It does not modify `scripts/render_read_proxy_server.py`, `src/alpha_orchestrator/render_read_proxy.py`, or their dependencies, so no Render deploy is required for Phase 4.9 validation.
