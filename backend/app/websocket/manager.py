"""WebSocket connection manager — streams task state to connected clients.

Events are also persisted (TaskEvent rows), so reconnecting clients recover
the full timeline via GET /api/tasks/{id}/events?after_seq=...
"""
import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Dict, List, Set

from fastapi import WebSocket

log = logging.getLogger("nebula.ws")


@dataclass
class Client:
    ws: WebSocket
    task_id: str


class ConnectionManager:
    def __init__(self):
        self._clients: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, task_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._clients.setdefault(task_id, set()).add(ws)
        log.debug("WS connected for task %s", task_id)

    async def disconnect(self, task_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._clients.get(task_id)
            if conns:
                conns.discard(ws)
                if not conns:
                    self._clients.pop(task_id, None)

    async def broadcast(self, task_id: str, message: dict):
        payload = json.dumps(message, default=str)
        async with self._lock:
            targets: List[WebSocket] = list(self._clients.get(task_id, ()))
        dead = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(task_id, ws)

    def connection_count(self, task_id: str) -> int:
        return len(self._clients.get(task_id, ()))


manager = ConnectionManager()
