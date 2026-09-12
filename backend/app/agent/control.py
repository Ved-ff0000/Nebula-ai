"""Task control primitives: per-task pause/stop signals and the approval gate."""
import asyncio
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class TaskControl:
    task_id: str
    pause_event: asyncio.Event = field(default_factory=asyncio.Event)   # set = paused
    stop_requested: bool = False
    approval_future: Optional[asyncio.Future] = None
    approval_id: Optional[str] = None

    def pause(self):
        self.pause_event.set()

    def resume(self):
        self.pause_event.clear()

    def stop(self):
        self.stop_requested = True
        self.resume()  # unblock if paused
        self._resolve_approval(None)  # unblock if waiting for approval

    def _resolve_approval(self, decision):
        fut = self.approval_future
        if fut and not fut.done():
            fut.set_result(decision)

    async def wait_if_paused(self):
        while self.pause_event.is_set() and not self.stop_requested:
            await asyncio.sleep(0.2)

    async def wait_for_approval(self, approval_id: str, timeout: float) -> Optional[str]:
        """Returns 'approved' | 'rejected' | None (timeout/stop)."""
        loop = asyncio.get_running_loop()
        self.approval_id = approval_id
        self.approval_future = loop.create_future()
        try:
            return await asyncio.wait_for(self.approval_future, timeout=timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            self.approval_future = None
            self.approval_id = None

    def resolve_approval(self, approval_id: str, decision: str) -> bool:
        """API-side approval resolution. Only the CURRENT pending approval counts."""
        if self.approval_id != approval_id or not self.approval_future or self.approval_future.done():
            return False
        self.approval_future.set_result(decision)
        return True


class TaskRegistry:
    """In-memory registry of running task controls (max one runner per task)."""

    def __init__(self):
        self._controls: Dict[str, TaskControl] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    def register(self, control: TaskControl, runner: asyncio.Task):
        self._controls[control.task_id] = control
        self._tasks[control.task_id] = runner

    def get(self, task_id: str) -> Optional[TaskControl]:
        return self._controls.get(task_id)

    def unregister(self, task_id: str):
        self._controls.pop(task_id, None)
        self._tasks.pop(task_id, None)

    def is_running(self, task_id: str) -> bool:
        t = self._tasks.get(task_id)
        return bool(t and not t.done())


registry = TaskRegistry()
