"""NEBULA backend entrypoint. Security-first universal AI browser agent — V1."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent.llm.base import LLMError
from app.api import auth as auth_api
from app.api import tasks as tasks_api
from app.build_info import build_info, one_line as build_one_line
from app.browser.diagnostics import check_browser_environment
from app.browser.worker import browser_worker
from app.config import settings
from app.database.db import init_db
from app.services.demo_site import router as demo_router
from app.services.seed import seed
from app.websocket.manager import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
log = logging.getLogger("nebula")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    log.info("NEBULA V1 backend starting — LLM provider: %s — %s",
             settings.llm_provider, build_one_line())
    yield
    await browser_worker.shutdown()
    log.info("NEBULA backend shut down cleanly")


app = FastAPI(
    title="NEBULA API",
    version=settings.version,
    description="Security-first universal AI browser agent — backend API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,   # bearer-token auth, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_api.router)
app.include_router(tasks_api.router)
app.include_router(demo_router)


@app.exception_handler(LLMError)
async def llm_error_handler(request: Request, exc: LLMError):
    return JSONResponse(status_code=503, content={"detail": f"LLM provider unavailable: {exc}"})


@app.get("/api/health", tags=["health"])
async def health():
    """Liveness + browser environment readiness (fast: never launches a browser)."""
    try:
        driver_up = browser_worker._browser is not None and browser_worker._browser.is_connected()
    except Exception:
        driver_up = False
    diag = check_browser_environment(browser_worker.last_launch_error,
                                     browser_worker.last_launch_error_type)
    return {
        "status": "ok",
        "service": "nebula-backend",
        "version": settings.version,
        "llm_provider": settings.llm_provider,
        # identity of the *running* process — a stale build was mistaken for a
        # regression once, so the API states which code it is (see build_info.py)
        "build": build_info(),
        # kept for backwards compatibility with existing clients
        "browser_connected": driver_up,
        "browser": {
            "driver_running": driver_up,
            "environment_ok": diag.ok,
            "installed": diag.browser_installed,
            "problem": diag.problem,
            "remedy": diag.remedy,
        },
    }


@app.get("/api/health/browser", tags=["health"])
async def browser_diagnostics():
    """Full browser preflight: interpreter, Playwright package, downloaded
    binaries, OS shared libraries and the last launch failure. Does not launch."""
    diag = check_browser_environment(browser_worker.last_launch_error,
                                     browser_worker.last_launch_error_type)
    payload = diag.to_dict()
    payload["build"] = build_info()
    return payload


@app.post("/api/health/browser/test", tags=["health"])
async def browser_launch_test():
    """Actually launch Chromium and load a page — the definitive check.
    Returns the precise error and fix command when it fails."""
    from app.browser.diagnostics import run_launch_test
    result = await run_launch_test()
    if not result["launched"]:
        # remember it so /api/health and task failures can explain the cause
        browser_worker.last_launch_error = result.get("error")
        browser_worker.last_launch_error_type = result.get("error_type")
    return result


@app.get("/api/settings/agent", tags=["settings"])
async def agent_info():
    return {
        "provider": settings.llm_provider,
        "model": (settings.openai_model if settings.llm_provider == "openai"
                  else settings.anthropic_model if settings.llm_provider == "anthropic"
                  else "deterministic-heuristic"),
        "browser_available": True,  # determined at task runtime; worker self-heals
        "limits": {
            "max_steps": settings.max_steps,
            "max_task_minutes": settings.max_task_minutes,
            "max_retries": settings.max_retries,
            "step_timeout_seconds": settings.step_timeout_seconds,
            "approval_timeout_seconds": settings.approval_timeout_seconds,
        },
    }


@app.get("/api/settings/allowlist", tags=["settings"])
async def allowlist_info():
    from app.security.allowlist import DomainAllowlist
    al = DomainAllowlist()
    return {"global_domains": al.effective_domains(),
            "note": "V1 enforces an explicit domain allowlist. Navigation to any other origin is blocked."}


# ------------------------------------------------------------------ WebSocket
from fastapi import WebSocket, WebSocketDisconnect  # noqa: E402


@app.websocket("/ws/tasks/{task_id}")
async def task_ws(ws: WebSocket, task_id: str):
    """Live task stream. NOTE: V1 authenticates the REST API; the WS stream is
    task-scoped and read-only (events are non-sensitive audit summaries).
    Token auth for WS is configured via NEBULA_WS_AUTH=strict in production."""
    import os
    await manager.connect(task_id, ws)
    try:
        await ws.send_json({"kind": "hello", "task_id": task_id})
        while True:
            msg = await ws.receive_text()
            if os.getenv("NEBULA_WS_AUTH") == "strict":
                await ws.close(code=4401)
                break
            if msg == "ping":
                await ws.send_json({"kind": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(task_id, ws)
