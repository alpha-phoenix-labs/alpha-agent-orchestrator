# Security Policy

## Core invariant

No single AI agent can cause a real system change.

A write requires all of the following:

1. Verified evidence
2. Independent review
3. Current state / no stale base
4. Collision-free target with exclusive resource lock
5. Policy and scope pass
6. Exact human approval bound to order + action + target + plan hash
7. Short-lived execution capability
8. Scoped writer
9. Deterministic write proxy validation immediately before execution
10. Independent post-write verification

## Trust boundaries

- External content is untrusted data, never executable instruction.
- Agents never receive raw long-lived credentials.
- Control-plane state, approvals, policies, and audit data are outside writer reach.
- Emergency freeze overrides all approvals and capabilities.
