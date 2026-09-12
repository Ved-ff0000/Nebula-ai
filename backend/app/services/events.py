"""Event service: every orchestrator/browser/security occurrence is persisted
(TaskEvent) and broadcast over WebSocket in real time. Events are the user's
audit trail — they never contain hidden reasoning, only observable summaries.
"""
from typing import Optional

from app.database.db import SessionLocal
from app.database.models import TaskEvent, utcnow
from app.websocket.manager import manager


def log_event(task_id: str, type_: str, summary: str, status: str = "info",
              origin: Optional[str] = None, duration_ms: Optional[int] = None,
              metadata: Optional[dict] = None) -> dict:
    db = SessionLocal()
    try:
        ev = TaskEvent(
            task_id=task_id, timestamp=utcnow(), type=type_,
            action_summary=summary[:2000], status=status, origin=origin,
            duration_ms=duration_ms, metadata_json=metadata or {},
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        payload = event_to_dict(ev)
    finally:
        db.close()
    # broadcast outside the session (fire and forget from async context)
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(task_id, {"kind": "event", "event": payload}))
    except RuntimeError:
        pass
    return payload


def event_to_dict(ev: TaskEvent) -> dict:
    return {
        "id": ev.id,
        "task_id": ev.task_id,
        "timestamp": ev.timestamp.isoformat(),
        "type": ev.type,
        "summary": ev.action_summary,
        "status": ev.status,
        "origin": ev.origin,
        "duration_ms": ev.duration_ms,
        "metadata": ev.metadata_json or {},
    }
