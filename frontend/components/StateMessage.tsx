"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { humaniseLegacyMessage } from "@/lib/format";
import type { BrowserDiagnostics, TaskDetail } from "@/lib/types";
import { IconCheck, IconWarn } from "./icons";

interface StateCopy {
  title: string;
  body: string;
  tone: "warn" | "bad" | "info";
  action?: string;
  /** true when the cause is the local browser environment → show the fix */
  browserIssue?: boolean;
}

/**
 * Guard against "dangling" error strings — e.g. an old row stored before the
 * driver-error fix, whose message is literally `Browser could not be started:`.
 * Such text is never shown bare: a plain-language sentence is appended so the
 * card always says *something* actionable.
 */
export function tidyErrorMessage(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "The task stopped before it could finish, and no further detail was recorded.";
  if (humaniseLegacyMessage(text) !== text) {
    // Legacy row written by a pre-fix backend: keep the sentence it did record,
    // then say plainly what is missing and where this machine's diagnostics are.
    return `${text.replace(/[\s:：]+$/, "")} — the browser driver returned no detail message. `
      + "Diagnostics for this machine are below.";
  }
  return text;
}

/**
 * Polished error & security states — each explains what happened and what the
 * user can do next (never a dead end, never a false success).
 */
export function stateCopyFor(task: TaskDetail): StateCopy | null {
  const detail = tidyErrorMessage(task.error);
  const err = (task.error || "").toLowerCase();
  switch (task.status) {
    case "FAILED":
      if (err.includes("browser unavailable") || err.includes("browser could not"))
        return {
          title: "Browser unavailable",
          body: detail || "The sandboxed browser session could not be started, so no actions were executed.",
          tone: "bad",
          browserIssue: true,
        };
      if (err.includes("time limit"))
        return {
          title: "Time limit reached",
          body: "NEBULA enforces a bounded execution window. The task was stopped before it could run indefinitely.",
          tone: "warn",
          action: "Narrow the goal or raise NEBULA_MAX_TASK_MINUTES for longer research runs.",
        };
      if (err.includes("retry limit"))
        return {
          title: "Retry limit reached",
          body: "Several steps failed repeatedly (site errors, timeouts or changed markup), so the agent stopped instead of looping forever.",
          tone: "warn",
          action: "Check the activity log for the failing step, then retry with a narrower goal.",
        };
      if (err.includes("step limit"))
        return {
          title: "Step limit reached",
          body: "The agent used its full step budget without producing verified evidence for the goal.",
          tone: "warn",
          action: "Split the goal into smaller tasks, or raise NEBULA_MAX_STEPS.",
        };
      if (err.includes("approval timed out"))
        return {
          title: "Approval expired",
          body: "The consequential action was not approved in time, so it was never executed. Nothing was submitted.",
          tone: "warn",
          action: "Run the task again and decide when the approval card appears.",
        };
      if (err.includes("verification"))
        return {
          title: "Result could not be verified",
          body: "NEBULA only claims success with evidence. The collected material was insufficient to confirm the goal.",
          tone: "warn",
          action: "Review the partial findings, or rerun with a more specific goal.",
        };
      return {
        title: "Task failed",
        body: detail || "An unexpected error ended the task. It stopped safely.",
        tone: "bad",
        action: "Check the activity log for details, then start a new task.",
      };
    case "BLOCKED":
      return {
        title: "Blocked by security policy",
        body: detail || "The requested action is outside NEBULA's permitted action set and was not executed.",
        tone: "bad",
        action: "Reformulate the goal within the allowed boundaries (no credentials, payments, CAPTCHA or destructive actions).",
      };
    case "CANCELLED":
      return {
        title: "Stopped by you",
        body: "The kill switch was used. The browser session was closed immediately and no further actions were taken.",
        tone: "info",
        action: "A new task can be started at any time.",
      };
    default:
      return null;
  }
}

/**
 * Diagnose-the-browser panel. Shown when a task failed because the browser
 * could not start: it reports what this machine is missing and the exact command
 * that fixes it, and lets the user re-test the launch in place.
 */
function BrowserFixPanel() {
  const [diag, setDiag] = useState<BrowserDiagnostics | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.browserDiagnostics().then(setDiag).catch(() => setDiag(null));
  }, []);

  useEffect(load, [load]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the command is selectable text anyway */
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testBrowser();
      setTestResult(
        r.launched && r.loaded_page
          ? `✓ Browser launched and loaded a page in ${r.duration_ms} ms. Start a new task to try again.`
          : `✗ ${r.error ?? "Launch failed."}${r.remedy ? ` Fix: ${r.remedy}` : ""}`,
      );
      load();
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : "Test failed"}`);
    } finally {
      setTesting(false);
    }
  };

  const remedy = diag?.remedy;
  const healthy = diag?.ok ?? false;

  return (
    <div className="mt-3 rounded-xl border border-white/15 bg-black/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        Browser diagnostics — this machine
      </p>

      {!diag && <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">Checking the browser environment…</p>}

      {diag && (
        <>
          <dl className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-[var(--color-ink-faint)]">Platform</dt>
              <dd className="text-[var(--color-ink-muted)]">{diag.platform}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-[var(--color-ink-faint)]">Python</dt>
              <dd className="text-[var(--color-ink-muted)]">{diag.python}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-[var(--color-ink-faint)]">Playwright package</dt>
              <dd className={diag.playwright_installed ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                {diag.playwright_version ?? "not installed"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-[var(--color-ink-faint)]">Chromium binary</dt>
              <dd className={diag.browser_installed ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                {diag.browser_installed ? "found" : "not found"}
              </dd>
            </div>
            {diag.missing_system_libs.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-ink-faint)]">Missing system libraries</dt>
                <dd className="break-words text-[var(--color-danger)]">{diag.missing_system_libs.join(", ")}</dd>
              </div>
            )}
          </dl>

          {diag.problem && (
            <p className="mt-2 flex items-start gap-2 text-[12px] text-[var(--color-warning)]">
              <span className="mt-0.5 shrink-0"><IconWarn size={13} /></span>
              {diag.problem}
            </p>
          )}

          {remedy && (
            <div className="mt-2">
              <p className="text-[11px] text-[var(--color-ink-muted)]">Run this in your project directory to fix it:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--color-void-line)] bg-black/50 px-3 py-2 font-mono text-[11px] text-[var(--color-success)]">
                  {remedy}
                </code>
                <button onClick={() => copy(remedy)} className="btn-ghost px-2.5 py-1.5 text-[11px]">
                  {copied ? <IconCheck size={13} /> : "copy"}
                </button>
              </div>
            </div>
          )}

          {healthy && (
            <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-success)]">
              <IconCheck size={13} /> The browser environment is ready — start a new task to continue.
            </p>
          )}

          {/* Which backend produced this card — a stale process was mistaken for
              a regression once, so every failure screenshot now carries it. */}
          {diag?.build && (
            <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-faint)]">
              backend build {diag.build.commit}
              {diag.build.dirty ? " + uncommitted" : ""} · diagnostics rev {diag.build.diagnostics_revision}
            </p>
          )}

          <button onClick={runTest} disabled={testing} className="btn-ghost mt-3 px-3 py-1.5 text-[11px]">
            {testing ? "Launching Chromium…" : "Test browser launch"}
          </button>

          {testResult && (
            <p className={`mt-2 text-[12px] ${testResult.startsWith("✓") ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {testResult}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function StateMessage({ task }: { task: TaskDetail }) {
  const copy = stateCopyFor(task);
  if (!copy) return null;

  const tone =
    copy.tone === "bad"
      ? "border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)]/[0.07] text-[var(--color-danger)]"
      : copy.tone === "warn"
      ? "border-[rgba(245,185,79,0.30)] bg-[var(--color-warning-bg)]/[0.07] text-[var(--color-warning)]"
      : "border-[rgba(33,150,243,0.35)] bg-[rgba(33,150,243,0.10)]/[0.07] text-[var(--color-accent-200)]";

  return (
    <section role="status" className={`animate-fade-up rounded-2xl border p-4 ${tone}`}>
      <h3 className="text-sm font-semibold">{copy.title}</h3>
      <p className="mt-1 text-[13px] leading-snug opacity-90">{copy.body}</p>
      {copy.action && <p className="mt-2 text-[12px] opacity-80">Next: {copy.action}</p>}
      {copy.browserIssue && <BrowserFixPanel />}
    </section>
  );
}
