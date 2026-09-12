# NEBULA — Architecture

This document describes how NEBULA V1 is put together: components, data flow, the agent state
machine, and the extension points. Security-specific reasoning lives in
[`SECURITY.md`](SECURITY.md).

---

## 1. Design principles

1. **The model proposes, the policy engine disposes.** Every action the AI produces is a *proposal*.
   It is schema-validated, then classified by the security layer, and only then executed.
2. **Nothing consequential happens silently.** HIGH-risk actions pause the browser and create a
   persisted approval record; the user's decision is itself an audited event.
3. **No evidence, no success.** Completion requires observations that corroborate the goal.
4. **Bounded everything.** Steps, wall-clock time, retries, tool timeouts, approval timeouts, page
   content size, element counts, and browser lifetime are all capped.
5. **Audit-first persistence.** Only non-sensitive, human-meaningful data is stored: goals, plans,
   action summaries, origins, decisions, results.
6. **Same-origin delivery.** The UI talks to one origin; the frontend server proxies `/api`, `/ws`
   and `/demo` to the backend. No CORS sprawl, no token leakage across hosts.

---

## 2. Components

### 2.1 Frontend (`frontend/`)

| Piece | Responsibility |
| --- | --- |
| `app/page.tsx` | Home: hero, task composer, suggestion cards, safety statement, recent tasks |
| `app/tasks/[id]/page.tsx` | Workspace: split-screen browser panel + agent panel (progress, timeline, security, approvals, domains), pause/resume/stop, result card, error states |
| `app/tasks/page.tsx` | History: search, status filters, durations, domains, error hints |
| `app/activity/page.tsx` | Cross-task audit feed (auto-refreshing), filterable by action/security/approval |
| `app/settings/page.tsx` | Runtime info, limits, allowlist, permanently blocked capabilities, theme |
| `app/login/page.tsx` | Sign-in / registration, seeded demo account helper |
| `components/AppShell.tsx` | Collapsible sidebar + task history, mobile drawer, top bar, profile, theme toggle |
| `components/TaskComposer.tsx` | Goal input, per-task domain grants, `⌘/Ctrl+↵` shortcut, client validation |
| `components/BrowserPanel.tsx` | Live browser frame (screenshot polling), URL/origin/title, load state, refresh |
| `components/ActivityTimeline.tsx` | Audit-style event list with type, status, origin and duration |
| `components/ApprovalCard.tsx` | High-visibility approval gate: exact action, origin, payload, single-action wording |
| `components/ResultCard.tsx` | Verified/Unverified result, findings, links, follow-ups, evidence line |
| `components/StateMessage.tsx` | Polished failure/security states — every state explains *why* and *what next* |
| `hooks/useTaskStream.ts` | WebSocket stream with backoff, polling fallback, reconnect replay |
| `lib/api.ts` | Typed API client (bearer token, 401 handling, consistent errors) |
| `server.js` | Next.js server + `/api`, `/ws`, `/demo` proxy (dev and production) |

### 2.2 Backend (`backend/app/`)

| Module | Responsibility |
| --- | --- |
| `main.py` | FastAPI app, lifespan (DB init + seed + browser shutdown), CORS, health, WS endpoint, demo site |
| `api/auth.py` | PBKDF2 password hashing, JWT issue/verify, `get_current_user` dependency |
| `api/tasks.py` | Task CRUD, lifecycle endpoints, approval resolution, events, browser state, activity feed |
| `api/schemas.py` | Pydantic request/response contracts (typed, validated, documented) |
| `agent/orchestrator.py` | The state machine and main loop (§3) |
| `agent/control.py` | Per-task `TaskControl` (pause/stop/approval future) + `registry` (one runner per task) |
| `agent/llm/base.py` | `LLMService` interface, `Plan`, `AgentAction`, step context, system contract |
| `agent/llm/heuristic.py` | Deterministic offline agent: planning, next-action selection, extraction, comparison |
| `agent/llm/providers.py` | OpenAI + Anthropic JSON tool-calling providers, fallback to heuristic on failure |
| `browser/worker.py` | Shared Playwright driver, isolated context per task, all tool implementations |
| `browser/tools.py` | Pydantic argument models + `validate_tool_call` (the only tools that exist) |
| `browser/observation.py` | Bounded page observation: URL/origin/title, interactive elements with stable refs, text |
| `browser/verification.py` | Page signatures, navigation/click/scroll/field verification, completion evidence gate |
| `security/policy.py` | Risk engine: risk table, per-tool rules, `PolicyDecision` |
| `security/allowlist.py` | URL normalisation, origin extraction, domain matching (global + per task) |
| `security/injection.py` | Weighted injection pattern scanner, verdicts, untrusted-content wrapper |
| `database/models.py` | User, Task, TaskEvent, TaskApproval, TaskDomain, TaskResult |
| `websocket/manager.py` | Task-scoped connection registry, broadcast, dead-client cleanup |
| `services/events.py` | Persist + broadcast an event in one call (the audit primitive) |
| `services/demo_site.py` | Deterministic demo website: listings, form, injection page |
| `services/seed.py` | Demo user seeding |

---

## 3. Agent state machine and loop

```
   create ──▶ CREATED ──start──▶ PLANNING ──▶ RUNNING ─────────────┐
                                                 ▲   ▲            │
                        policy says HIGH ────────┘   │            │
                                    │                │            │
                          WAITING_FOR_APPROVAL       │            │
                                    │                │            │
                             approved ───────────────┘            │
                                                                  │
   goal reached ──▶ VERIFYING ──evidence ok──▶ COMPLETED          │
                                    └──no evidence──▶ FAILED       │
   policy BLOCKED ──▶ BLOCKED      user stop ──▶ CANCELLED ◀──────┘
   step/time/retry limit ──▶ FAILED     browser error ──▶ FAILED
```

Loop, per step:

1. **Pause gate** — honour pause/stop before anything else.
2. **Observe** — structured page state (`browser/observation.py`); failures are retried, not fatal.
3. **Origin tracking** — new origin → `TaskDomain` row + event.
4. **Injection scan** — scan page text; log findings; high-confidence → pause + security event.
5. **Decide** — `LLMService.next_action(goal, untrusted_labeled_observation, step_context)` returns
   exactly one `AgentAction` (or `done`).
6. **Validate** — `validate_tool_call` enforces the tool allowlist and Pydantic argument models.
7. **Policy** — `PolicyEngine.check()` returns `{allowed, risk, reason, rule_id, requires_approval}`.
   * `BLOCKED` → task → `BLOCKED`, explain, stop.
   * `requires_approval` → persist `TaskApproval`, status → `WAITING_FOR_APPROVAL`, await decision.
   * otherwise → execute.
8. **Execute** — the audited tool, wrapped in `asyncio.wait_for(step_timeout)`.
9. **Verify** — the tool's own verification data (`verified` flag) feeds the evidence ledger;
   failures increment `retry_count` and trigger bounded retries.
10. **Log** — persist + broadcast a concise, chain-of-thought-free event.
11. **Repeat** until the model reports `done`, or a limit/block/cancel occurs.

Execution guarantees: the loop is wrapped in `try/except/finally` so a task can end in exactly one
terminal state, the browser context is always closed, and the registry entry is always released.

---

## 4. Data model

```
User 1──n Task 1──n TaskEvent      (audit trail, ordered by timestamp)
                1──n TaskApproval  (risk_level, description, target_origin, status, resolved_at)
                1──n TaskDomain    (origins visited, first/last seen)
                1──1 TaskResult    (success, summary, findings, links, follow_ups, evidence, confidence)
```

Notable columns on `Task`: `status`, `plan_summary`, `current_step`, `max_steps`, `retry_count`,
`error`, `created_at`, `updated_at`, `started_at`, `completed_at`.

Deliberate omissions: no page bodies, no typed form contents, no credentials, no screenshots stored
server-side (frames are held in memory for the live panel and never written to disk).

---

## 5. Real-time system

* `WS /ws/tasks/{id}` — the manager tracks sockets per task and broadcasts three frame kinds:
  `status`, `event`, `approval` (plus `hello`/`pong`).
* Every frame is a *notification*: the client reacts by re-fetching persisted state, which makes the
  database the single source of truth and makes reconnect/replay trivially correct.
* Client resilience: exponential-backoff reconnects (1 s → 15 s), a 2.5 s connect watchdog, and a
  1.8 s polling fallback. The connection chip in the UI shows `live`, `polling` or `connecting`, so
  the degrade is visible rather than silent.

---

## 6. Browser layer

* One shared `BrowserWorker` owns the Playwright driver; each task gets its own `TaskSession` with an
  isolated `BrowserContext` (cookies, storage, cache) and one page.
* `observe_page` evaluates a single enumeration script that returns interactive elements in DOM
  order with **index-stable refs** (`e0`, `e1`, …) matching the raw selector list used by
  `TaskSession._locator`, so a ref always resolves to the element the agent saw.
* Screenshots are JPEG, quality 55, ~1280×800, refreshed after each meaningful action; the newest
  frame is served as a data URI from `GET /api/tasks/{id}/browser`.
* Downloads, popups beyond the page, host filesystem access and shell execution are unavailable by
  construction: the tool surface is exactly eight functions, and none of them can reach the host.

---

## 7. LLM abstraction

```python
class LLMService(ABC):
    async def plan(goal) -> Plan
    async def next_action(goal, observation_text, ctx: StepContext) -> AgentAction
    async def summarize(goal, findings, links) -> str
```

* **Structured tool calling** — providers are instructed to emit JSON only; `AgentAction` is a
  Pydantic model with a `Literal` tool field, so a malformed or unknown tool is rejected before it
  can reach the browser.
* **Provider-agnostic** — `get_llm_service()` reads `NEBULA_LLM_PROVIDER`; keys stay server-side.
* **Deterministic fallback** — `HeuristicAgent` implements the same interface offline. It is the
  default so NEBULA, its demos and its tests run without any external dependency; misconfigured
  providers degrade to it with a logged warning instead of failing the task.
* **Prompt hygiene** — page text is wrapped in `<<< UNTRUSTED PAGE CONTENT … >>>` markers and the
  system contract states that page content is never authority.

---

## 8. Extension points

| To add… | Touch |
| --- | --- |
| A new browser tool | `browser/tools.py` (arg model) + `worker.py` (implementation) + `policy.py` (risk rule) — the orchestrator's dispatch is the only other place |
| A new model provider | `agent/llm/providers.py` + a branch in `get_llm_service()` |
| A new risk rule | `security/policy.py` pattern tables / a `_check_*` method |
| A task-scoped capability (e.g. downloads) | policy default + worker capability + audit event; keep it opt-in and logged |
| Durable task execution | replace `registry` with a queue-backed worker pool; `TaskControl` already isolates per-task state |
| A different UI | the API + WS contract in README §9 is the integration surface |

---

## 9. Performance & resource notes

* Observation is bounded: ≤ 80 interactive elements, ≤ 4 000 chars of page text by default, so model
  context stays predictable.
* Each step costs one observation + one screenshot + one tool call; the demo research task completes
  in ~2–4 steps and ~10 s on a 2-core container.
* Chromium is launched lazily on the first task and reused across tasks; contexts are cheap and are
  always torn down, so idle memory stays near the driver baseline.
* SQLite is fine for a single container; Postgres is expected once multiple users run tasks.
