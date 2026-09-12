"use client";

import type { TaskDetail } from "@/lib/types";

interface StateCopy {
  title: string;
  body: string;
  tone: "warn" | "bad" | "info";
  action?: string;
}

/**
 * Polished error & security states — each explains what happened and what the
 * user can do next (never a dead end, never a false success).
 */
export function stateCopyFor(task: TaskDetail): StateCopy | null {
  const err = (task.error || "").toLowerCase();
  switch (task.status) {
    case "FAILED":
      if (err.includes("browser unavailable") || err.includes("browser could not"))
        return {
          title: "Browser unavailable",
          body: "The sandboxed browser session could not be started or crashed. The task stopped safely and no actions were executed after the failure.",
          tone: "bad",
          action: "Start a new task — the browser worker self-heals on the next run.",
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
        body: task.error || "An unexpected error ended the task. It stopped safely.",
        tone: "bad",
        action: "Check the activity log for details, then start a new task.",
      };
    case "BLOCKED":
      return {
        title: "Blocked by security policy",
        body: task.error || "The requested action is outside NEBULA's permitted action set and was not executed.",
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

export function StateMessage({ task }: { task: TaskDetail }) {
  const copy = stateCopyFor(task);
  if (!copy) return null;

  const tone =
    copy.tone === "bad"
      ? "border-rose-400/35 bg-rose-500/[0.07] text-rose-100"
      : copy.tone === "warn"
      ? "border-amber-400/35 bg-amber-500/[0.07] text-amber-100"
      : "border-sky-400/30 bg-sky-500/[0.07] text-sky-100";

  return (
    <section role="status" className={`animate-fade-up rounded-2xl border p-4 ${tone}`}>
      <h3 className="text-sm font-semibold">{copy.title}</h3>
      <p className="mt-1 text-[13px] leading-snug opacity-90">{copy.body}</p>
      {copy.action && <p className="mt-2 text-[12px] opacity-80">Next: {copy.action}</p>}
    </section>
  );
}
