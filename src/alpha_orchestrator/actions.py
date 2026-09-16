from __future__ import annotations

CODE_ACTIONS = frozenset({"git_commit", "git_branch", "pull_request", "merge"})
INFRA_ACTIONS = frozenset({"render_deploy", "approved_runtime_config"})
ALL_ACTIONS = CODE_ACTIONS | INFRA_ACTIONS

ACTION_WRITERS = {
    **{action: "code_writer" for action in CODE_ACTIONS},
    **{action: "infra_writer" for action in INFRA_ACTIONS},
}


def writer_for_action(action: str) -> str | None:
    return ACTION_WRITERS.get(action)
