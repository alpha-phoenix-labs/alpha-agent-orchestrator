# Architecture

```text
USER
  |
  v
LEADER (no write capability)
  |
  +--> deterministic ROUTER
  |
  +--> 10 READ-ONLY specialist agents
  |        |
  |        v
  |    evidence bundle
  |        |
  |        +--> Evidence Verifier
  |        +--> Independent Reviewer
  |
  v
DETERMINISTIC CONTROL PLANE
  State Guard -> Collision Guard -> Policy Guard -> Scope Guard -> Freshness Guard
  |
  v
HUMAN GATE (USER ONLY)
  |
  v
short-lived capability
  |
  +--> Code Writer
  +--> Infra Writer
          |
          v
      WRITE PROXY
          |
          v
      target system
          |
          v
      Post-Write Verifier
          |
          v
      hash-chained Audit Log
```

The orchestrator starts in `OFFLINE` mode. Real integrations are deliberately absent from the initial scaffold.
