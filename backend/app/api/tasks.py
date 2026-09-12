"""Task endpoints: creation, listing, detail, lifecycle control, approvals,
events, and live browser state. All routes require authentication; users can
only see their own tasks (ownership enforced at query level)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.agent import orchestrator
from app.agent.control import registry
from app.api.auth import get_current_user
from app.api.schemas import (
    ActivityItemOut, ApprovalDecisionRequest, ApprovalOut, BrowserStateOut,
    EventOut, ResultOut, TaskCreate, TaskDetailOut, TaskOut,
)
from app.browser.worker import BrowserUnavailable, browser_worker
from app.config import settings
from app.database.db import get_db
from app.database.models import Task, TaskApproval, TaskEvent, User, utcnow
from app.services.events import event_to_dict

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

ACTIVE_STATES = {"PLANNING", "RUNNING", "WAITING_FOR_APPROVAL", "VERIFYING"}


def _own_task(db: Session, user: User, task_id: str) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found.")
    return task


def _control_or_409(task: Task):
    control = registry.get(task.id)
    if control is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Task is not actively running (status={task.status}).")
    return control


def _task_fields(task: Task) -> dict:
    """Explicit ORM→schema mapping (avoids SQLAlchemy relationship collisions)."""
    return {
        "id": task.id, "goal": task.goal, "status": task.status,
        "plan_summary": task.plan_summary, "current_step": task.current_step,
        "max_steps": task.max_steps, "retry_count": task.retry_count, "error": task.error,
        "created_at": task.created_at, "updated_at": task.updated_at,
        "started_at": task.started_at, "completed_at": task.completed_at,
        "domains": [d.origin for d in task.domains],
    }


def _to_out(db: Session, task: Task) -> TaskOut:
    return TaskOut(**_task_fields(task))


@router.post("", response_model=TaskOut, status_code=201)
def create_task(req: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = Task(user_id=user.id, goal=req.goal.strip(), max_steps=settings.max_steps, status="CREATED")
    db.add(task)
    db.commit()
    db.refresh(task)
    from app.services.events import log_event
    log_event(task.id, "status", "Task created — ready to start.", metadata={"goal": task.goal[:500]})
    return _to_out(db, task)


@router.get("", response_model=List[TaskOut])
def list_tasks(
    q: Optional[str] = Query(None, max_length=200, description="search in goal"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Task).filter(Task.user_id == user.id)
    if q:
        query = query.filter(Task.goal.ilike(f"%{q}%"))
    if status_filter:
        query = query.filter(Task.status == status_filter.upper())
    tasks = query.order_by(Task.created_at.desc()).limit(limit).all()
    return [_to_out(db, t) for t in tasks]


@router.get("/activity", response_model=List[ActivityItemOut])
def activity(limit: int = Query(100, le=500), user: User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """Recent events across the user's tasks (Activity page)."""
    rows = (db.query(TaskEvent)
            .join(Task, Task.id == TaskEvent.task_id)
            .filter(Task.user_id == user.id)
            .order_by(TaskEvent.timestamp.desc())
            .limit(limit).all())
    return [ActivityItemOut(task_id=e.task_id, timestamp=e.timestamp, type=e.type,
                            summary=e.action_summary, status=e.status, origin=e.origin)
            for e in rows]


@router.get("/{task_id}", response_model=TaskDetailOut)
def get_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    return TaskDetailOut(
        **_task_fields(task),
        events=[EventOut.from_event(e) for e in task.events],
        approvals=[ApprovalOut.model_validate(a) for a in task.approvals],
        result=ResultOut.model_validate(task.result) if task.result else None,
    )


@router.post("/{task_id}/start", response_model=TaskOut)
async def start_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    if task.status in ACTIVE_STATES:
        raise HTTPException(status.HTTP_409_CONFLICT, "Task is already running.")
    if task.status == "COMPLETED":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Completed tasks cannot restart in V1 — create a new task instead.")
    task.status = "CREATED"  # orchestrator will move it to PLANNING
    task.error = None
    task.retry_count = 0
    task.current_step = 0
    db.commit()
    if not orchestrator.start_task(task.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Task runner is already active.")
    return _to_out(db, task)


@router.post("/{task_id}/pause", response_model=TaskOut)
def pause_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    _control_or_409(task).pause()
    from app.services.events import log_event
    log_event(task_id, "status", "Task paused by user.", status="warning")
    return _to_out(db, task)


@router.post("/{task_id}/resume", response_model=TaskOut)
def resume_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    _control_or_409(task).resume()
    from app.services.events import log_event
    log_event(task_id, "status", "Task resumed by user.")
    return _to_out(db, task)


@router.post("/{task_id}/stop", response_model=TaskOut)
async def stop_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    control = registry.get(task.id)
    if control:
        control.stop()
        # kill switch: also cancel the asyncio runner directly if it's stuck
        from app.agent.control import registry as reg
        runner = reg._tasks.get(task_id)
        if runner and not runner.done():
            await asyncio_wait_runner(runner, timeout=8)
    else:
        if task.status in ACTIVE_STATES:  # stale state (e.g. server restart)
            task.status = "FAILED"
            task.error = "Task interrupted: runner not found (server restart or kill switch)."
            task.completed_at = utcnow()
            db.commit()
    from app.services.events import log_event
    log_event(task_id, "status", "Stop requested (kill switch armed).", status="warning")
    return _to_out(db, task)


async def asyncio_wait_runner(runner, timeout: float):
    import asyncio
    try:
        await asyncio.wait_for(asyncio.shield(runner), timeout=timeout)
    except Exception:
        runner.cancel()


@router.post("/{task_id}/approve/{approval_id}", response_model=ApprovalOut)
def approve_action(task_id: str, approval_id: str,
                   req: ApprovalDecisionRequest,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _resolve(db, user, task_id, approval_id, "APPROVED", req.reason)


@router.post("/{task_id}/reject/{approval_id}", response_model=ApprovalOut)
def reject_action(task_id: str, approval_id: str,
                  req: ApprovalDecisionRequest,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _resolve(db, user, task_id, approval_id, "REJECTED", req.reason)


def _resolve(db, user, task_id, approval_id, decision, reason) -> ApprovalOut:
    task = _own_task(db, user, task_id)
    approval = (db.query(TaskApproval)
                .filter(TaskApproval.id == approval_id, TaskApproval.task_id == task_id)
                .one_or_none())
    if not approval:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval request not found.")
    if approval.status != "PENDING":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Approval already resolved ({approval.status}). Single-action approvals "
                            "cannot be reused or changed.")
    # The approval gate must belong to the CURRENTLY awaited approval of a live runner.
    control = registry.get(task_id)
    applied = bool(control and control.resolve_approval(approval_id, decision.lower()))
    if not applied:
        approval.status = "EXPIRED"
        approval.resolved_at = utcnow()
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This approval request is no longer the one being awaited "
                            "(it may have timed out or the task moved on).")
    approval.status = decision
    approval.resolved_at = utcnow()
    db.commit()
    db.refresh(approval)
    from app.services.events import log_event
    log_event(task_id, "approval",
              f"User {decision.lower()} the action." + (f" Reason: {reason}" if reason else ""),
              status="success" if decision == "APPROVED" else "warning",
              origin=approval.target_origin, metadata={"approval_id": approval.id})
    return approval


@router.get("/{task_id}/events", response_model=List[EventOut])
def task_events(task_id: str, after: Optional[str] = Query(None, description="return events after this id"),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    rows = task.events
    if after:
        idx = next((i for i, e in enumerate(rows) if e.id == after), None)
        if idx is not None:
            rows = rows[idx + 1:]
    return [EventOut.from_event(e) for e in rows]


@router.get("/{task_id}/browser", response_model=BrowserStateOut)
def browser_state(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _own_task(db, user, task_id)
    session = browser_worker.get_session(task_id)
    if session is None:
        # No live session: return the last observed frame so the workspace still
        # shows what the agent finally saw (explicitly marked as closed).
        final = browser_worker.get_final_frame(task_id)
        if final and final.get("screenshot"):
            return BrowserStateOut(
                available=False, status="closed", url=final.get("url", ""),
                origin=final.get("origin", ""), title=final.get("title", ""),
                screenshot=f"data:image/jpeg;base64,{final['screenshot']}",
                updated_at=final.get("updated_at"),
            )
        return BrowserStateOut(available=False, status="offline")
    page = session.page
    try:
        title = page.url and ""
    except Exception:
        pass
    screenshot_uri = f"data:image/jpeg;base64,{session.last_screenshot_b64}" if session.last_screenshot_b64 else None
    try:
        url = session.page.url
        title = "…"
    except Exception:
        url = ""
    return BrowserStateOut(
        available=True, url=url, origin=session.current_origin, title=title,
        status=session.status, screenshot=screenshot_uri,
        updated_at=session.screenshot_updated_at or None,
    )
