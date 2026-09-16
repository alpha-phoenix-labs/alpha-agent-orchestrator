from __future__ import annotations

from .models import WorkOrder


def mock_git_executor(order: WorkOrder) -> dict:
    return {"ok": True, "mock": True, "action": order.action, "target": order.target, "result": "simulated"}


def mock_render_executor(order: WorkOrder) -> dict:
    return {"ok": True, "mock": True, "action": order.action, "target": order.target, "result": "simulated"}
