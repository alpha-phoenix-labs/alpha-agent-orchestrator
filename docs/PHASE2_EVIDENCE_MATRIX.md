# Phase 2 Evidence Matrix — MOCK

| Acceptance criterion | Implementation evidence | Test/evidence path |
|---|---|---|
| Mock GitHub target | `mock_git_executor` | `src/alpha_orchestrator/mock_targets.py`, `test_full_code_mock_flow_passes` |
| Mock Render target | `mock_render_executor` | `src/alpha_orchestrator/mock_targets.py`, `test_full_infra_mock_flow_passes` |
| Collision denied | atomic resource lock collision | `test_atomic_resource_lock_collision` |
| Stale state denied | state change after approval/capability | `test_state_change_after_approval_blocks_execution`, `test_state_change_after_capability_mint_is_denied_by_proxy` |
| Replay denied | approval, capability and execution-id replay protections | `test_approval_is_single_use`, `test_capability_is_single_use_even_with_new_execution_id`, `test_execution_id_replay_blocked` |
| Scope denied | writer/action scope isolation | `test_writer_scope_isolated`, `test_unknown_writer_role_is_denied` |
| Human gate retained | demo stops before execution | `scripts/mock_demo.py`; CI asserts `WAITING_FOR_APPROVAL` and `No write was executed.` |

This matrix records the Phase 2 acceptance mapping only. It does not claim Phase 3 or later readiness.
