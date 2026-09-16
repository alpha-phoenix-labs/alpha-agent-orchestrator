# Setup immediately after the repository exists

Recommended repository

- **Name:** `alpha-agent-orchestrator`
- **Visibility:** Private
- **Description:** `Zero-trust multi-agent control plane for ALPHA: read-only specialist agents, independent verification, human-gated writes, resource locks and tamper-evident audit.`
- **Default branch:** `main`
- **Initialize with README:** No, if importing this prepared scaffold immediately.

## First safe bootstrap

1. Upload/import this scaffold to the empty private repository.
2. Keep `ALPHA_SYSTEM_MODE=OFFLINE` and `ALPHA_WRITES_ENABLED=false`.
3. Enable branch protection/ruleset for `main`.
4. Require pull requests for changes to `main`.
5. Require CI before merge once workflows are added.
6. Do **not** add Creator/Render write credentials.
7. Run the offline tests.
8. Only after tests pass, move to `MOCK` mode.

## First branch

Create:

`bootstrap/control-plane-v0.1`

All initial changes should land through this branch and a PR. Do not work directly on `main`.
