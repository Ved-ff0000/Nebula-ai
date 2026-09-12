"""NEBULA orchestrator — the agent state machine.

CREATED → PLANNING → RUNNING ⇄ (WAITING_FOR_APPROVAL | VERIFYING) →
COMPLETED | FAILED | CANCELLED | BLOCKED

Loop per step:
  1. observe (bounded, structured, untrusted-labeled)
  2. prompt-injection scan of page content (pause/block on high-confidence hits)
  3. select next action (LLM/heuristic, schema-validated)
  4. POLICY ENGINE decision — the model never overrides it
  5. HIGH risk → persist approval + WAITING_FOR_APPROVAL until a user decision
  6. execute via audited browser tool (timeout-bounded)
  7. VERIFY the effect (no evidence → no success)
  8. persist + broadcast an observable, chain-of-thought-free event
  9. re-plan / stop on completion, cancellation, blocks, or limits
"""
import asyncio
import logging
import time
from datetime import timedelta
from typing import List, Optional

from app.agent.control import TaskControl, registry
from app.agent.llm.base import LLMService, StepContext
from app.browser.tools import validate_tool_call
from app.browser.worker import BrowserUnavailable, browser_worker
from app.config import settings
from app.database.db import SessionLocal
from app.database.models import Task, TaskApproval, TaskDomain, TaskResult, utcnow
from app.security.allowlist import URLNormalizer
from app.security.injection import InjectionVerdict, InjectionDetector, wrap_untrusted
from app.security.policy import PolicyContext, PolicyEngine, RiskLevel
from app.services.events import log_event

log = logging.getLogger("nebula.orchestrator")


class Orchestrator:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.policy = PolicyEngine()
        self.injection = InjectionDetector()
        self.llm: LLMService = None  # set in run()
        self.control: TaskControl = registry.get(task_id) or TaskControl(task_id)
        self.step = 0
        self.history: List[dict] = []
        self.findings: List[str] = []
        self.links: List[str] = []
        self.evidence = {"verified_actions": 0, "pages_read": 0, "origins": [], "verifications": []}
        self.rejection_context: Optional[str] = None

    # ------------------------------------------------------------------ helpers
    def _db_task(self, db) -> Task:
        return db.query(Task).filter(Task.id == self.task_id).one()

    def _set_status(self, db, status: str, error: Optional[str] = None, commit_result: bool = False,
                    success: bool = False, result_payload: Optional[dict] = None):
        task = self._db_task(db)
        task.status = status
        task.current_step = self.step
        if error is not None:
            task.error = error
        if status in ("COMPLETED", "FAILED", "CANCELLED", "BLOCKED"):
            task.completed_at = utcnow()
        if commit_result and result_payload:
            from app.database.models import TaskResult as TR
            existing = db.query(TR).filter(TR.task_id == self.task_id).one_or_none()
            if not existing:
                existing = TR(task_id=self.task_id)
                db.add(existing)
            existing.success = result_payload["success"]
            existing.summary = result_payload["summary"]
            existing.findings = result_payload.get("findings", [])
            existing.links = result_payload.get("links", [])
            existing.follow_ups = result_payload.get("follow_ups", [])
            existing.evidence = result_payload.get("evidence", {})
            existing.confidence = result_payload.get("confidence", 0.0)
            task.result = existing
        db.commit()
        payload = {"kind": "status", "task_id": self.task_id, "status": status,
                   "step": self.step, "error": error}
        asyncio.get_running_loop().create_task(_broadcast(payload))
        return task

    def _check_stop(self) -> bool:
        return self.control.stop_requested

    async def _gate(self, session):
        """Pause gate + hard stop check before every action."""
        await self.control.wait_if_paused()
        if self._check_stop():
            raise _Cancelled()

    # --------------------------------------------------------------------- run
    async def run(self):
        db = SessionLocal()
        session = None
        try:
            self.llm = _get_llm()
            task = self._db_task(db)
            task.started_at = utcnow()
            task.max_steps = task.max_steps or settings.max_steps
            db.commit()
            deadline = time.monotonic() + settings.max_task_minutes * 60

            self._set_status(db, "PLANNING")
            plan = await self.llm.plan(task.goal)
            task = self._db_task(db)
            task.plan_summary = plan.summary
            db.commit()
            log_event(self.task_id, "plan", f"Plan: {plan.summary}", metadata={"steps": plan.steps})
            self._set_status(db, "RUNNING")

            session = await browser_worker.start_task_session(self.task_id)

            while self.step < task.max_steps:
                if time.monotonic() > deadline:
                    raise _TimeLimit()
                await self._gate(session)

                # ---- observe
                obs = await session.observe()
                if obs.error:
                    log_event(self.task_id, "error", "Page observation failed; retrying.",
                              status="warning", metadata={"detail": obs.error})
                    await asyncio.sleep(0.6)
                    continue

                # ---- origin tracking + prompt-injection defense
                if obs.origin and obs.origin != self.evidence["origins"][-1:] and obs.origin not in self.evidence["origins"]:
                    self.evidence["origins"].append(obs.origin)
                    d = db.query(TaskDomain).filter_by(task_id=self.task_id, origin=obs.origin).one_or_none()
                    if not d:
                        db.add(TaskDomain(task_id=self.task_id, origin=obs.origin))
                        db.commit()
                    log_event(self.task_id, "navigation", f"Now on {obs.origin}", origin=obs.origin)

                scan = self.injection.scan(obs.text)
                if scan["verdict"] != InjectionVerdict.NONE:
                    level = "high" if scan["verdict"] == InjectionVerdict.HIGH else "suspicious"
                    log_event(self.task_id, "security",
                              f"Prompt-injection {level}: page content contained instruction-like text. "
                              "Content will be treated as untrusted data only.",
                              status="warning", origin=obs.origin, metadata={"score": scan["score"]})
                    if level == "high":
                        self.control.pause()
                        log_event(self.task_id, "security",
                                  "Task paused due to high-confidence injection signals. Review the page and resume or stop.",
                                  status="warning", origin=obs.origin)
                        await self._gate(session)

                # ---- decide
                obs_context = wrap_untrusted(obs.model_context())
                ctx = StepContext(step=self.step + 1, max_steps=task.max_steps,
                                  action_history=self.history[-12:],
                                  rejection_context=self.rejection_context)
                action = await self.llm.next_action(task.goal, obs_context, ctx)
                await self._gate(session)

                if action.tool == "done":
                    await self._complete(db, task, action, obs)
                    return

                # ---- validate + POLICY
                clean_args, err = validate_tool_call(action.tool, action.args)
                if err:
                    log_event(self.task_id, "error", f"Model produced an invalid action ({err}); skipping.",
                              status="warning")
                    self.step += 1
                    continue
                decision = self.policy.check(
                    {"tool": action.tool, "args": clean_args.model_dump()},
                    PolicyContext(task_id=self.task_id, current_origin=obs.origin),
                )

                if not decision.allowed:
                    log_event(self.task_id, "security",
                              f"Action blocked by policy: {action.tool} — {decision.reason}",
                              status="blocked", origin=obs.origin, metadata={"rule": decision.rule_id})
                    self._set_status(db, "BLOCKED", error=decision.reason)
                    log_event(self.task_id, "status", "Task blocked by security policy.", status="blocked")
                    await self._finish(db, session)
                    return

                if decision.requires_approval:
                    approved = await self._request_approval(db, action, clean_args.model_dump(),
                                                            decision, obs.origin)
                    if approved is None:
                        continue  # stop requested / timeout
                    if not approved:
                        self.rejection_context = f"{action.tool} — {decision.reason}"
                        log_event(self.task_id, "approval", "Action rejected by user; agent will adapt.",
                                  status="warning", origin=obs.origin)
                        continue
                    log_event(self.task_id, "approval", "Single-action approval granted for this step.",
                              origin=obs.origin)

                # ---- execute (timeout-bounded)
                self.step += 1
                self._set_status(db, "RUNNING")
                log_event(self.task_id, "action", f"{action.rationale or action.tool}",
                          origin=obs.origin, metadata={"tool": action.tool, "risk": decision.risk})
                result = await asyncio.wait_for(
                    self._execute(session, action.tool, clean_args.model_dump()),
                    timeout=settings.step_timeout_seconds,
                )
                verified = bool(result.data.get("verified", result.ok))
                self.history.append({"tool": action.tool, "summary": result.summary,
                                     "verified": verified, "risk": decision.risk.value})
                log_event(self.task_id, "action", result.summary,
                          status="success" if result.ok else "failed",
                          origin=obs.origin or session.current_origin,
                          duration_ms=result.duration_ms,
                          metadata={"tool": result.tool, "detail": result.data})

                # ---- verify evidence
                if result.ok and verified:
                    self.evidence["verified_actions"] += 1
                    self.evidence["verifications"].append({"tool": action.tool, "ok": True})
                if action.tool == "read_page" and result.ok:
                    self.evidence["pages_read"] += 1
                if result.ok:
                    self.findings.extend(action.findings or [])
                    self.links.extend(action.links or [])
                else:
                    task = self._db_task(db)
                    task.retry_count += 1
                    db.commit()
                    if task.retry_count > settings.max_retries:
                        raise _RetryLimit()
                    log_event(self.task_id, "verification",
                              f"Step failed; bounded retry {task.retry_count}/{settings.max_retries}.",
                              status="warning")

            raise _StepLimit()

        except _Cancelled:
            self._set_status(db, "CANCELLED", error="Stopped by user.")
            log_event(self.task_id, "status", "Task stopped by user.", status="warning")
        except _StepLimit:
            msg = f"Step limit reached ({settings.max_steps})."
            self._set_status(db, "FAILED", error=msg)
            log_event(self.task_id, "error", msg, status="failed")
        except _TimeLimit:
            msg = f"Time limit reached ({settings.max_task_minutes} min)."
            self._set_status(db, "FAILED", error=msg)
            log_event(self.task_id, "error", msg, status="failed")
        except _RetryLimit:
            msg = "Retry limit reached after repeated step failures."
            self._set_status(db, "FAILED", error=msg)
            log_event(self.task_id, "error", msg, status="failed")
        except BrowserUnavailable as e:
            self._set_status(db, "FAILED", error=str(e))
            log_event(self.task_id, "error", f"Browser unavailable: {e}", status="failed")
        except asyncio.TimeoutError:
            msg = f"A step exceeded its {settings.step_timeout_seconds}s timeout."
            self._set_status(db, "FAILED", error=msg)
            log_event(self.task_id, "error", msg, status="failed")
        except Exception as e:  # noqa: BLE001 — last-resort guard: task must never hang
            log.exception("Task %s crashed", self.task_id)
            self._set_status(db, "FAILED", error=f"Unexpected error: {type(e).__name__}")
            log_event(self.task_id, "error", f"Unexpected error: {type(e).__name__}", status="failed")
        finally:
            await self._finish(db, session)

    # --------------------------------------------------------------- execution
    async def _execute(self, session, tool: str, args: dict):
        if tool == "navigate":
            return await session.navigate(args["url"])
        if tool == "go_back":
            return await session.go_back()
        if tool == "read_page":
            return await session.read_page()
        if tool == "screenshot":
            return await session.screenshot()
        if tool == "click":
            return await session.click(args["element_ref"], args.get("label", ""))
        if tool == "type":
            return await session.type_text(args["element_ref"], args["text"], args.get("label", ""))
        if tool == "scroll":
            return await session.scroll(args["direction"])
        if tool == "wait_for_load":
            return await session.wait_for_load()
        raise RuntimeError(f"Unreachable: unknown tool {tool}")  # policy already filters

    # ---------------------------------------------------------------- approval
    async def _request_approval(self, db, action, args, decision, origin) -> Optional[bool]:
        """True=approved, False=rejected, None=stop/timeout."""
        approval = TaskApproval(
            task_id=self.task_id,
            action_id=f"{self.task_id}:{self.step + 1}",
            risk_level=decision.risk.value, description=decision.reason,
            target_origin=origin or "unknown", payload_summary=_payload_summary(action, args),
        )
        db.add(approval)
        db.commit()
        db.refresh(approval)
        self._set_status(db, "WAITING_FOR_APPROVAL")
        log_event(self.task_id, "approval",
                  f"Approval required before {action.tool}: {decision.reason}",
                  status="warning", origin=origin,
                  metadata={"approval_id": approval.id, "risk": decision.risk.value})
        broadcast = asyncio.get_running_loop().create_task(_broadcast({
            "kind": "approval", "approval": {
                "id": approval.id, "task_id": self.task_id, "risk_level": approval.risk_level,
                "description": approval.description, "target_origin": approval.target_origin,
                "payload_summary": approval.payload_summary, "status": "PENDING",
                "tool": action.tool,
            }}))

        decision_str = await self.control.wait_for_approval(
            approval.id, timeout=settings.approval_timeout_seconds)

        approval_row = db.query(TaskApproval).filter(TaskApproval.id == approval.id).one()
        if decision_str == "approved":
            approval_row.status = "APPROVED"
            approval_row.resolved_at = utcnow()
            db.commit()
            return True
        if decision_str == "rejected":
            approval_row.status = "REJECTED"
            approval_row.resolved_at = utcnow()
            db.commit()
            return False
        # timeout or stop
        approval_row.status = "EXPIRED"
        approval_row.resolved_at = utcnow()
        db.commit()
        if self.control.stop_requested:
            raise _Cancelled()
        self._set_status(db, "FAILED", error="Approval timed out; consequential action not performed.")
        log_event(self.task_id, "approval", "Approval request timed out; task ended without executing it.",
                  status="failed")
        await self._finish(db, None)
        raise _Finished()

    # --------------------------------------------------------------- completion
    async def _complete(self, db, task, action, obs):
        self._set_status(db, "VERIFYING")
        from app.browser.verification import completion_evidence_ok
        self.evidence["origins"] = list(dict.fromkeys(self.evidence["origins"]))
        ok, detail = completion_evidence_ok(self.evidence)
        answer = action.final_answer or await self.llm.summarize(task.goal, self.findings, self.links)
        if not ok:
            answer = ("I could not verify this goal with sufficient evidence, so I am not marking it as "
                      f"success. {detail} Partial view: " + answer[:600])
        self._set_status(db, "COMPLETED" if ok else "FAILED",
                         error=None if ok else "Verification failed: insufficient evidence.",
                         commit_result=True, success=ok,
                         result_payload={
                             "success": ok, "summary": answer,
                             "findings": (action.findings or self.findings)[:12],
                             "links": (action.links or self.links)[:10],
                             "follow_ups": action.follow_ups or [],
                             "evidence": {**self.evidence, "check": detail},
                             "confidence": 0.9 if ok else 0.2,
                         })
        log_event(self.task_id, "result",
                  ("Task completed. " if ok else "Task ended without verified success. ") + detail,
                  status="success" if ok else "warning", origin=obs.origin,
                  metadata={"answer": answer[:1500]})
        if not ok:
            log_event(self.task_id, "error", "Verification could not confirm the goal.", status="failed")

    async def _finish(self, db, session):
        if getattr(self, "_finished", False):
            return
        self._finished = True
        if session is not None or browser_worker.get_session(self.task_id) is not None:
            await browser_worker.close_task_session(self.task_id)
        registry.unregister(self.task_id)
        log_event(self.task_id, "status", "Browser session closed and cleaned up.")
        db.close()


# ------------------------------------------------------------------ utilities
class _Cancelled(Exception):
    pass


class _StepLimit(Exception):
    pass


class _TimeLimit(Exception):
    pass


class _RetryLimit(Exception):
    pass


class _Finished(Exception):
    pass


def _payload_summary(action, args) -> str:
    if action.tool == "click":
        return f"Click '{args.get('label') or args.get('element_ref')}'"
    if action.tool == "type":
        return (f"Type into '{args.get('label') or args.get('element_ref')}': "
                f"{args.get('text', '')[:120]}")
    return str(args)[:200]


def _get_llm() -> LLMService:
    from app.agent.llm.providers import get_llm_service
    return get_llm_service()


async def _broadcast(payload: dict):
    from app.websocket.manager import manager
    await manager.broadcast(payload.get("task_id", ""), payload)


# ------------------------------------------------------------------- launcher
def start_task(task_id: str) -> bool:
    """Start the orchestrator for a task. Returns False if already running."""
    if registry.is_running(task_id):
        return False
    control = registry.get(task_id) or TaskControl(task_id)
    orch = Orchestrator(task_id)
    orch.control = control
    runner = asyncio.get_running_loop().create_task(orch.run())
    registry.register(control, runner)
    return True
