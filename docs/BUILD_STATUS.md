# NEBULA — Build Status

**Read this file first** if you are continuing work with another AI coding agent. Update it before
you end a session. Never rewrite working components unnecessarily — continue from this state.

Last updated: 2026-09-12 · Version: **V1.0.0 (complete)**

---

## 1. Current phase

**Phase 7 — complete.** All seven phases of the master specification are implemented, tested and
documented. The project is runnable end-to-end locally and via Docker.

**Current test status:** backend `pytest` **64 passed** · frontend `vitest` **16 passed** ·
`tsc --noEmit` clean · `next build` succeeds. A browser-environment *doctor* is available:
`make doctor` (or `python backend/scripts/diagnose.py --launch`).

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Architecture + frontend shell | ✅ |
| 2 | Backend + database | ✅ |
| 3 | Browser automation (Playwright/Chromium) | ✅ |
| 4 | Agent loop (state machine, tools, verification) | ✅ |
| 5 | Security + approval system | ✅ |
| 6 | Real-time activity + task history | ✅ |
| 7 | Testing, Docker, docs, polish | ✅ |

---

## 2. Completed features

**Agent runtime** — natural-language goals · task planning · observe→reason→plan→act→verify loop ·
state machine (`CREATED, PLANNING, RUNNING, WAITING_FOR_APPROVAL, VERIFYING, COMPLETED, FAILED,
CANCELLED, BLOCKED`) · bounded retries · step/time/approval limits · kill switch.

**Browser** — Playwright + Chromium · isolated context per task · DOM/a11y element enumeration with
stable refs · bounded text + element counts · screenshots for visual context · live preview ·
guaranteed cleanup · downloads blocked · no host filesystem/shell access.

**Tools (the complete surface)** — `navigate, go_back, read_page, screenshot, click, type, scroll,
wait_for_load`. Each validates arguments (Pydantic), passes policy, enforces timeout, returns
structured results and emits an audited event.

**Security** — risk engine with final authority (LOW/MEDIUM/HIGH/BLOCKED) · explicit domain
allowlist (global + per-task) with URL normalisation · prompt-injection scanner + untrusted-content
labelling + auto-pause on high confidence · permanently blocked capability set.

**Human control** — approval cards (exact action, origin, payload, reason) · Approve once / Reject /
Stop · single-action semantics · pause / resume / stop · approvals persisted with reviewer notes.

**Verification** — navigation URL/origin, click DOM-delta, field read-back, scroll delta,
completion evidence gate; no evidence ⇒ no success claim.

**Persistence** — User, Task, TaskEvent, TaskApproval, TaskDomain, TaskResult (SQLAlchemy;
PostgreSQL in Docker, SQLite locally). No sensitive data stored.

**Real time** — `/ws/tasks/{id}` broadcasting status/events/approvals with task-scoped connections,
dead-client cleanup, and a client that falls back to polling and replays the timeline on reconnect.

**Frontend** — premium dark-first control centre with light theme: home/hero + composer +
suggestions, split-screen task workspace (live browser panel, progress, activity/security/approvals/
domains tabs, result card), task history with search + filters, activity feed, settings, login/
register, collapsible sidebar + mobile drawer, polished error/security states, responsive layouts.

**Ops** — Dockerfiles (Playwright base for the worker, multi-stage Next build for the UI),
docker-compose (db + backend + frontend), healthchecks, `.env.example`, Makefile, this file,
README, ARCHITECTURE, SECURITY.

**Deterministic demo site** (served by the backend) — `/demo/`, `/demo/internships`,
`/demo/feedback` (+submit/success), `/demo/injection`.

---

## 3. File inventory (created this build)

```
nebula/
├── README.md · Makefile · docker-compose.yml · .env.example
├── docs/ARCHITECTURE.md · docs/SECURITY.md · docs/BUILD_STATUS.md
├── docker/backend.Dockerfile · docker/frontend.Dockerfile
├── backend/
│   ├── requirements.txt · pytest.ini
│   ├── app/main.py · app/config.py
│   ├── app/api/{auth,tasks,schemas}.py
│   ├── app/agent/{orchestrator,control}.py
│   ├── app/agent/llm/{base,heuristic,providers}.py
│   ├── app/browser/{worker,tools,observation,verification}.py
│   ├── app/security/{policy,allowlist,injection}.py
│   ├── app/database/{db,models}.py
│   ├── app/websocket/manager.py
│   ├── app/services/{events,demo_site,seed}.py
│   └── tests/{conftest,test_security_policy,test_api,test_agent_e2e}.py
└── frontend/
    ├── package.json · tsconfig.json · next.config.mjs · tailwind.config.ts · postcss.config.mjs
    ├── vitest.config.ts · .eslintrc.json · server.js
    ├── app/{layout,page,globals.css} · app/login · app/tasks · app/tasks/[id] · app/activity · app/settings
    ├── components/{AppShell,TaskComposer,BrowserPanel,ActivityTimeline,ApprovalCard,ResultCard,StateMessage,Toast,NebulaLogo,ui}.tsx
    ├── hooks/{useTaskStream,useTheme}.ts(x) · lib/{api,types,format}.ts
    ├── tests/{setup.ts,components.test.tsx} · public/{robots.txt,.gitkeep}
```

---

## 4. Commands already run (and their results)

| Command | Result |
| --- | --- |
| `pip install -r backend/requirements.txt` (+ `python-multipart`, `email-validator`, `pytest-asyncio`) | ok |
| `python -m playwright install chromium` + system libs (`libnspr4`, `libnss3`, …) | ok — Chromium launches, screenshots captured |
| `python -m pytest` (backend) | **37 passed** (13 policy/security, 19 API, 5 real-browser E2E) |
| `npx tsc --noEmit` (frontend) | **clean** |
| `npx vitest run` (frontend) | **13 passed** |
| `npx next build` | **success** (6 routes + dynamic task route) |
| Live run: uvicorn :8000 + node server.js :3000 (dev) | login, task creation, browser automation, approvals verified through the proxy |
| Demo task (internships research) | `COMPLETED`, correct best-match role, evidence recorded |

---

## 5. Post-build hardening pass (bugs found by running the real stack)

Fixed during visual QA of the live system (screenshots in `docs/screenshots/`):

1. **`server.js` upgrade path** — Next's internal WS upgrade was being routed through `getRequestHandler()`,
   producing `this.getHeader is not a function` / `Cannot read properties of undefined (reading 'bind')`
   on every request. Now uses `app.getUpgradeHandler()`. Consequence: clean logs and a stable dev server.
2. **Final browser frame** — finished tasks returned `available:false` with no frame, so the workspace
   looked empty after completion. `BrowserWorker` now keeps the last observed URL/title/frame in a bounded
   in-memory cache (`FINAL_FRAME_CACHE = 12`, never written to disk) and `/browser` returns it with
   `status="closed"`; the panel shows it dimmed with a "session closed" chip.
3. **Browser state fetch** — `useTaskStream` only fetched `/browser` for active tasks; now fetched for all
   statuses (transient failures keep the previous frame instead of clearing it).
4. **Approval wording** — approvals showed the raw element ref (`Click 'Submit form e3'`). The policy engine
   now prioritises the visible label and the heuristic passes the real button text, so the card reads
   `Clicking 'Submit feedback'…` with the control's actual name.
5. **Icon rendering** — emoji suggestion-card icons rendered as tofu boxes on systems without emoji fonts.
   Replaced with an original inline SVG icon set (`components/icons.tsx`) across the composer, timeline,
   approval card, result card, browser panel, nav and task controls.
6. **Findings quality** — listing extraction now filters badge/meta rows (`Hyderabad · Hybrid ₹30,000/mo…`)
   so the result card's findings read as sentences (`_is_prose`).

7. **`.gitignore` swallowed `frontend/lib/`** (found by cloning the pushed repo and building it, i.e.
   exactly what a new contributor does — *not* by any test in this repo). The Python-template line
   `lib/` is a *bare* pattern, so git matched it at every depth and silently dropped
   `frontend/lib/{api,types,format}.ts` from the commit; a fresh clone then failed with
   `Module not found: Can't resolve '@/lib/api'` and `GET / 500`.
   Fixes: every Python-template directory pattern is now **anchored** (`/lib/`, `/build/`, `/dist/`,
   `/var/`, `/parts/`, `/sdist/`, `/wheels/`, `/eggs/`, `/downloads/`) and the file documents why;
   an invalid inline comment was removed (gitignore has no inline-comment syntax — it had silently
   disabled the `next-env.d.ts` rule); `make verify-tracked` was added and **fails the build if any
   source file on disk is untracked**.
   Lesson for future sessions: `pytest`/`vitest`/`tsc`/`next build` all run against the *working
   directory*, so they cannot catch an incomplete push. Validate the artefact, not just the machine:
   `git clone <repo> /tmp/v && (cd /tmp/v/frontend && npm ci && npm run build)` — or at minimum
   `make verify-tracked` before pushing.

8. **`Browser could not be started:` — message truncated at the colon** (reported by the user from the live
   timeline UI, twice). Root causes: (a) Playwright's `TimeoutError()`/`Error()` are frequently raised with
   **no message at all**, so `str(exc) == ""` and `f"…started: {exc}"` renders a dangling colon; (b)
   `BrowserUnavailable` already carried a "Browser unavailable:" prefix and the orchestrator added another,
   producing doubled labels; (c) nothing in the codebase ever said *what* was wrong or how to fix it; and
   (d) `_finish()` emitted a "Browser session closed and cleaned up" event even when the launch had failed,
   so the log implied a session that never existed.
   Fixes: new `app/browser/diagnostics.py` with `describe_exception()` (guaranteed non-empty, always names
   the exception type, falls back to `.message`/`args`, flags bare timeouts, strips Playwright's
   box-art/trailing signature and truncates sensibly); `check_browser_environment()` (package version,
   browser dirs, executable discovery, `ldd`-based missing-*system*-library detection, last launch error,
   `problem` + `remedy`); `run_launch_test()` (real launch + page load); new
   `backend/scripts/diagnose.py` + `make doctor`; `/api/health` gained a `browser` block and
   `GET /api/health/browser` + `POST /api/health/browser/test` were added (the old `browser_connected`
   field is kept for compatibility); `worker.py` stores `last_launch_error` and logs with `exc_info=True`;
   `orchestrator.py` emits the driver error **and** "No browser actions were executed…" and only logs
   teardown when a live session existed; the frontend gained `BrowserFixPanel` (inside `StateMessage`),
   a browser-environment section on `/settings`, and `tidyErrorMessage()` so that even *pre-existing*
   database rows containing a bare `…started:` still render as a full sentence.
   Verified by `tests/test_diagnostics.py` (19 tests) plus an end-to-end simulation with
   `PLAYWRIGHT_BROWSERS_PATH=/tmp/definitely-not-installed`: task → `FAILED`, stored error 402 chars,
   no trailing colon, names the cause, ends with `Fix: python -m playwright install --with-deps chromium`,
   timeline shows the error and the "no actions were executed" follow-up, and **no** spurious teardown event.
   On this machine the same code path found 12 genuinely missing system libraries
   (`libXdamage.so.1`, `libasound.so.2`, `libatk…`, `libnss3.so`, …) and the recommended
   `sudo python3 -m playwright install-deps chromium` fixed it — re-check `ok: True`, launch test 997 ms.

   Lesson for future sessions: **never interpolate an exception into a user-facing string** — Playwright (and
   much of the stdlib) can raise with an empty message. Route every driver error through
   `describe_exception()`; it is the only place that guarantees non-empty, actionable text.

9. **Stat chips rendered as huge circles** (spotted in the screenshot of the fix for item 8 — the
   `elapsed / retries / origins` pills overlapped the progress bar). Cause: the pills live in a
   `<div class="flex flex-wrap gap-2">` that is itself a *grid cell*, so `align-items: stretch` made every
   `.chip` as tall as the cell (~86 px); with `rounded-full` an 86 px-tall pill is a circle.
   Fixed at both ends: `items-start` on all five chip rows (`app/tasks/[id]/page.tsx`, `app/tasks/page.tsx`,
   `app/activity/page.tsx`, `app/settings/page.tsx`, `components/ApprovalCard.tsx`) **and** the `.chip`
   utility now sets `h-fit w-fit self-start`, so a future container cannot reintroduce it.
   Verified by measuring computed geometry in a real browser (`getBoundingClientRect().height > 40` on
   every `.chip`) across `/tasks/[id]`, `/tasks`, `/activity` and `/settings` — this class of bug is
   invisible to `vitest`/`tsc`, since jsdom has no layout engine. Screenshots:
   `docs/screenshots/09-browser-unavailable-fix.png`, `docs/screenshots/10-settings-browser-environment.png`.

10. **`requirements.txt` was incomplete — the pushed repo could not start at all** (found by the fresh-clone
   acceptance check, *not* by any test in this repo). `backend/app/services/demo_site.py` declares
   `name: str = Form("")` etc., and FastAPI raises **at import time** when `python-multipart` is absent —
   so on a clean machine `python -m uvicorn app.main:app` and even `import app.main` failed, taking the
   whole pytest suite with it. `pytest-asyncio` was missing too, so `pytest.ini`'s `asyncio_mode = auto`
   silently degraded: async tests could not be collected (the suite would have run without pytest-asyncio
   installed in the sandbox, masking it).
   Both are now pinned in `backend/requirements.txt` with the reason recorded inline. The codebase uses
   SQLAlchemy's **synchronous** engine over stdlib `sqlite3` — `aiosqlite`/`asyncpg` are *not* used
   anywhere (and `psycopg2-binary` remains Docker-only); the comment says so, to stop anyone "fixing"
   a phantom async-driver gap.
   Lesson for future sessions: the sandbox's **globally installed packages mask missing dependencies** —
   `pytest`, `tsc` and `next build` can all be green while the published artefact cannot boot. The only
   honest check is a clean environment:
   `python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt && .venv/bin/python -c "import app.main"`
   followed by `.venv/bin/python -m pytest` — run it inside a fresh `git clone` of the pushed repo.

11. **"Still broken after the fix" — the fix had never been loaded** (user re-reported the exact same
   truncated message *after* it was committed and pushed). Forensics: the reported task id `1b3d0897`
   does not exist in this workspace's database, the timestamps (14:18/14:19) are outside every session,
   and `grep -rn "could not be started"` in the shipped code shows exactly one raise site, emitting the
   new format. Their uvicorn process was still running the previous build — a stale process, not a
   regression. Nothing in the UI or API made that visible, which is the actual defect, so the backend now
   identifies itself:
   * `backend/app/build_info.py` — commit (`NEBULA_BUILD_COMMIT` env for Docker, else `git rev-parse`),
     `dirty` flag, start time, uptime, `diagnostics_revision`, advertised `features[]`.
   * `build` is included in `GET /api/health` and `GET /api/health/browser`, and the startup log now ends
     with `build <sha> · diagnostics revision N · pid-started <iso>`.
   * The settings page shows **Backend build** (with an amber "older backend" banner when the process does
     not advertise `actionable_launch_errors`), and the browser-fix card prints its build under the
     diagnosis, so any future screenshot carries the answer.
   * Old rows written by a pre-fix build are permanent in the database, so the UI now *labels* them
     instead of rendering them bare: `humaniseLegacyMessage()` in `lib/format.ts` (shared by the task
     timeline, the activity page and `StateMessage`) keeps whatever was recorded and states plainly that
     the entry predates the actionable-diagnostics fix.
   Lesson for future sessions: when a user reports "still broken" after a fix, **first ask which code their
   process is running** (`/api/health` → `build.commit`) — and make that question answerable from the UI.

---

## 6. Known bugs / open items

None blocking. Quality items intentionally left:

1. **Heuristic provider is scenario-aware** (research/compare, form+approval, read/inspect) — other
   goals work generically. Configure `openai`/`anthropic` for open-ended goals.
2. **Playwright Node E2E for the UI** is not wired: the browser-level E2E suite is the pytest one
   (real Chromium, real server); the UI is covered by vitest component tests, typecheck and build.
   Adding `@playwright/test` requires downloading a second browser in CI (`npx playwright install chromium`).
3. **WS auth is task-scoped and read-only.** Production hardening: set `NEBULA_WS_AUTH=strict`.
4. `next lint` (eslint 8 + eslint-config-next 14) is configured but has not been executed in this
   sandbox; the build and typecheck both pass. Run `npm run lint` once before shipping.
5. Browser worker is a singleton per process: concurrency is bounded by one orchestrator.

---

## 7. Next exact implementation steps (if continuing)

1. `cd backend && python -m pytest` — confirm 37 green; `cd frontend && npm test && npm run typecheck && npm run build`.
2. Run the demo (§README) in a real browser to exercise the live WS path instead of polling.
3. Optional hardening tasks, in priority order:
   a. WS token authentication (query param or first-frame auth) behind `NEBULA_WS_AUTH=strict`.
   b. A task queue + worker pool (Redis) with per-user concurrency limits.
   c. Approval *policies* (time-boxed, per-origin, scoped grants) with an admin view.
   d. Structured extraction schemas for research tasks (typed findings instead of prose).
   e. Playwright (@playwright/test) UI E2E in CI alongside the pytest suite.

---

## 8. Environment setup still required for a fresh machine

| Requirement | Command |
| --- | --- |
| Python deps | `pip install -r backend/requirements.txt` (+ `psycopg2-binary` if using Postgres) |
| Browser + system libs | `python -m playwright install --with-deps chromium` |
| Node deps | `cd frontend && npm install` |
| Config | `cp .env.example backend/.env` — set `NEBULA_JWT_SECRET`; optionally an LLM key |
| Run (dev) | `make backend` and `make frontend` (or uvicorn + `npm run dev`) |
| Run (docker) | `docker compose up --build` |
| Demo login | `demo@nebula.ai` / `nebula-demo-2024` |

---

## 9. Architectural invariants (do not break these)

1. The **policy engine** is the sole authority on whether an action executes; the model only proposes.
2. BLOCKED capabilities must remain *absent code paths*, not just rejected branches.
3. HIGH-risk actions pause **immediately before** execution and require a fresh, single-action decision.
4. `COMPLETED` requires verification evidence; unverified outcomes must report as unverified.
5. Page content is always untrusted data — labelled for the model, scanned for injection, never authority.
6. The browser tool surface is exactly the eight audited tools; no shell, filesystem or JS escape hatch.
7. Every state-changing event is persisted (audit trail) and broadcast (live stream).
8. No sensitive data (credentials, card data, page bodies, screenshots) is written to the database.
