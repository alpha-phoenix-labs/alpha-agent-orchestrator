# Threat Model — initial

Threats explicitly addressed:

- hallucinated reader conclusions
- stale system state (TOCTOU)
- two concurrent writers on one resource
- replay of an old approval
- broadened approval semantics
- writer privilege escalation
- prompt injection from repository/log/web content
- retry-induced duplicate writes
- compromised or faulty single agent
- audit tampering
- emergency stop failure

Non-goal for Phase 1: production-grade secret storage and network isolation. Those are added before real integrations.
