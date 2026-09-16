from .models import SystemMode
from .orchestrator import OrchestratorCore


def build_offline_core() -> OrchestratorCore:
    return OrchestratorCore(mode=SystemMode.OFFLINE, writes_enabled=False)


if __name__ == "__main__":
    core = build_offline_core()
    print("ALPHA Agent Orchestrator")
    print("mode=OFFLINE writes_enabled=false")
