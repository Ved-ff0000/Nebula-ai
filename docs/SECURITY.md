# NEBULA — Security Model

NEBULA is a browser agent: it opens real websites and can perform real actions. This document states
what it will and will not do, how each control is implemented, where the residual risk lives, and
how to configure it for a real deployment.

> **Defence in depth, not perfection.** The controls below are layered and conservative, but no
> browser agent can guarantee detection of every attack, and no policy engine can enumerate every
> dangerous action. Treat NEBULA as a bounded, audited, human-supervised agent — not as an
> autonomous authority.

---

## 1. Threat model

| # | Threat | Consequence if unchecked | NEBULA control |
| --- | --- | --- | --- |
| T1 | Model proposes a harmful action (hallucinated or manipulated) | Unwanted submission, payment, disclosure | Server-side policy engine with final authority; the model cannot bypass it |
| T2 | Prompt injection embedded in page content | Agent obeys hostile instructions, exfiltrates data | Untrusted-content labelling, weighted injection scanner, security events, auto-pause on high confidence, hard-blocked capability set |
| T3 | Credential/secret exfiltration | Account compromise | Credential/OTP/card/secret patterns are **BLOCKED** before execution; no secret storage; no vault integration |
| T4 | Financial or irreversible commitment | Money loss | Payment/purchase/checkout patterns **BLOCKED**; forms that "send/commit" require approval |
| T5 | CAPTCHA / anti-bot circumvention | ToS violation, legal exposure | CAPTCHA handling is **BLOCKED**; no stealth or anti-detection features exist in the codebase |
| T6 | Destructive account action | Data loss | Delete/deactivate account patterns **BLOCKED** |
| T7 | Arbitrary code / shell / filesystem access | Host compromise | The tool surface is eight fixed browser functions; no `evaluate_js`, no shell, no filesystem tool; downloads disabled; container runs as non-root |
| T8 | Malicious site attacks the browser process | Sandbox escape, resource exhaustion | Chromium sandbox, isolated context per task, bounded timeouts, guaranteed teardown, container-level isolation |
| T9 | Unbounded runaway agent | Cost/DoS | Step, wall-clock, retry, step-timeout and approval-timeout limits + kill switch |
| T10 | False success claims | User acts on unverified information | Verification subsystem; completion requires corroborating evidence, otherwise the result is reported as unverified |
| T11 | Task/telemetry leakage between users | Privacy breach | Ownership enforced at query level in every task endpoint; WS streams are task-scoped |
| T12 | Reviewer bypass via API | Unauthorised execution | Approvals bound to the *currently awaited* approval of a live run; reuse/foreign/stale ids are rejected; single-action semantics |

---

## 2. Risk classification

Implemented in `backend/app/security/policy.py`. Classification happens **before** execution and the
decision is persisted in the task's event stream.

| Level | Examples | Behaviour |
| --- | --- | --- |
| **LOW** | public navigation on an allowed domain, reading, scrolling, screenshots, ordinary search, safe clicks | executes automatically |
| **MEDIUM** | typing ordinary non-sensitive user-provided information, minor UI interaction | executes, but conservatively; credentials/payment fields escalate to BLOCKED |
| **HIGH** | clicking submit/send/post/reply/confirm/apply/register/book/reserve/agree, commitments, purchases, account changes | **pauses** — persisted approval request, browser frozen until the user decides |
| **BLOCKED** | passwords/OTPs/PINs/CVV/card numbers/API keys/tokens, payments, CAPTCHA bypass, destructive account actions, arbitrary code, mass/spam automation | **never executes**; the task ends `BLOCKED` with an explanation and a logged security event |

Detection combines the *tool* (`click` vs `read_page`) with the *target description* the model
supplied (label, element ref, selector, role) and the text it intends to type. Because the model's
own words are the input to classification, an adversarial page that manipulates the model's target
description can at worst move an action *between* MEDIUM and HIGH — the BLOCKED categories are
matched on both the label and the payload, and their executable path simply does not exist.

---

## 3. Human approval

* Triggered by a HIGH decision, **immediately before** the action.
* The approval card shows: the exact action, the target origin, the payload summary, why approval is
  required, and the risk level.
* Options: **Approve once**, **Reject**, **Stop task**. The agent cannot continue on its own.
* **Single-action**: each approval is bound to one pending action id. Approving does not authorise
  anything else, and the same id can never be resolved twice (409).
* **Stale-safe**: if the awaiting approval changed (timeout, restart, task moved on), a late decision
  is refused and recorded as `EXPIRED`.
* Every decision writes a `TaskApproval` row plus an audited event, with an optional reviewer note.

---

## 4. Prompt-injection defence

Website content is **untrusted data, never authority**.

1. **Labelling** — page text handed to the model is wrapped in explicit untrusted-content markers
   (`wrap_untrusted`), and the system contract states that nothing inside a page can change policy.
2. **Detection** — `security/injection.py` scans observations with a weighted pattern set
   (ignore/disregard instructions, "you are now unrestricted", reveal system prompt/keys,
   disable security, exfiltrate/send-to patterns, credential-entry lures, exec-web content, "new
   instructions:" preambles, autonomous-mode claims, …).
3. **Response** — findings always produce a `security` event; high-confidence findings pause the
   task and require the user to resume or stop.
4. **Structural limits** — even a successful injection cannot do damage: the tool set is fixed, the
   allowlist bounds navigation, BLOCKED categories have no code path, secrets are never available to
   the agent, and success still requires verification.
5. **Logging** — suspicious content is logged as an event with its score and matched pattern shapes;
   full page bodies are not stored.

Known limits: pattern matching misses novel or obfuscated phrasings (images, non-Latin scripts,
multi-turn grooming). This is why detection is *one* layer and not the only one.

---

## 5. Domain / origin control

* Explicit allowlist: global (`NEBULA_ALLOWED_DOMAINS`) plus per-task grants supplied at creation.
* Before navigation: URL normalisation → origin extraction → allowlist comparison. Failures produce a
  `domain_not_allowed` block and a logged security event; there is no "ask the model" fallback.
* Schemes other than `http`/`https` are rejected (`javascript:`, `data:`, `file:`, `ftp:`, …).
* Every origin transition creates/updates a `TaskDomain` row and an event; the UI shows the current
  origin and the visited-origin list.
* Wildcards match subdomains of an allowlisted registrable domain only (`*.example.com` style);
  there is no implicit "any ancestor" trust.

---

## 6. Sandboxing & isolation

* One `BrowserContext` per task (own cookies, storage, cache); contexts are destroyed on completion,
  cancellation, failure — and on unmatched exceptions.
* Downloads are disabled; the agent has no filesystem, shell, or arbitrary-network tool.
* Chromium runs inside the worker container as a **non-root** user with `no-new-privileges` and an
  enlarged `/dev/shm`; the host filesystem is never mounted in.
* Bounded execution: `NEBULA_STEP_TIMEOUT_SECONDS` per tool call, `NEBULA_MAX_TASK_MINUTES` per task,
  `NEBULA_MAX_STEPS` steps, `NEBULA_MAX_RETRIES` retries, `NEBULA_APPROVAL_TIMEOUT_SECONDS` for
  approvals — after which the task ends in a terminal state and resources are released.
* Kill switch: `POST /api/tasks/{id}/stop` flips the control flag (and cancels the runner), which
  unblocks pause/approval waits immediately.

---

## 7. Verification (anti-false-success)

* Navigation is verified by URL/origin/path comparison; clicks by URL/title/DOM-signature change;
  typing by reading the field value back; scrolls by scroll-position delta.
* The evidence ledger records verified actions, pages read and origins.
* `completion_evidence_ok()` gates `COMPLETED`: with insufficient evidence the task is reported as
  **not verified**, with the reason, and the partial answer is clearly labelled as partial.
* The UI mirrors this: the result card renders an explicit "Goal not verified / insufficient
  evidence" state when applicable.

---

## 8. Data handling

Persisted: account email + password hash (PBKDF2-HMAC-SHA256, 240 000 iterations, per-user salt),
task goal, plan summary, action summaries, event metadata (non-sensitive), origins, approval
descriptions/payload summaries (truncated to 120 chars for typed text), results and evidence.

**Never persisted:** credential material, card data, full form payloads, page bodies, screenshots,
session cookies or model prompts/keys. Screenshots live only in the worker's memory for the live
panel and disappear with the context.

Transport: bearer-token auth (JWT, HS256, configurable expiry); the UI stores the token in
`localStorage` and sends it only to the same origin, which proxies to the API. Deploy TLS in front
of the stack; `NEBULA_WS_AUTH=strict` closes WebSocket upgrades when you need token-gated streams.

---

## 9. Permanently out of scope (V1)

Autonomous purchases · banking/financial transactions · password management · credential extraction ·
autonomous account or security changes · autonomous email/message sending · account deletion ·
CAPTCHA solving or bypass · arbitrary shell execution · unrestricted filesystem access · stealth or
anti-detection · spam or mass automation · autonomous social-media posting · multi-agent swarms ·
secret extraction · any attempt to bypass NEBULA's own controls.

These are enforced as **absent capabilities**, not just as policies: there is no tool that could
perform them even if the model asked.

---

## 10. Residual risks (read this before deploying)

1. **Injection detection is heuristic.** Novel attacks may pass unlabelled. Mitigate with a tight
   allowlist and by reviewing the activity timeline after sensitive runs.
2. **The heuristic agent is scenario-aware.** Good for the documented demo shapes; for open-ended
   goals use a real LLM provider, which is likewise policy-bound but harder to predict.
3. **Approval fatigue.** A user who rubber-stamps approvals defeats the control. Treat the approval
   card as a real review: origin, payload, and why.
4. **Allowlist breadth is your exposure.** Adding `docs.python.org` grants read/navigation there;
   adding a site with destructive UI increases what a mis-classified action could reach.
5. **Shared deployment.** V1 assumes a small trusted user group. Add per-user quotas, audit export
   and rate limiting before exposing it widely.
6. **Browser CVEs.** Chromium is only as safe as its patch level — rebuild the worker image
   regularly (`docker compose build --pull`).
7. **Single-process orchestrator.** Concurrent task volume is bounded by CPU; exceeding it degrades
   latency, not safety.

---

## 11. Incident response checklist

1. `POST /api/tasks/{id}/stop` (or click **Stop** in the UI) — the kill switch fronts every wait.
2. Review the task's **Security** tab and the global **Activity** feed for the decision trail.
3. Identify the origin involved; if it was allowlisted per task, remove it from the task grant.
4. If a site is repeatedly hostile, remove it from `NEBULA_ALLOWED_DOMAINS` entirely.
5. Check logs (`nebula.orchestrator`, `nebula.browser`, `nebula.ws`) for the exception path.
6. Rotate the demo user / JWT secret if you suspect token misuse, then restart the API.
7. File the finding as a test case in `backend/tests/test_security_policy.py` (that suite exists to
   grow with exactly this kind of experience).
