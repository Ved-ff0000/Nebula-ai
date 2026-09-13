"use client";

import Link from "next/link";
import type { TaskDetail } from "@/lib/types";
import { Chip, SectionTitle } from "./ui";
import { IconCheck, IconStar, IconWarn } from "./icons";
import { durationFrom } from "@/lib/format";

/**
 * Final result experience. Success is only shown when the backend verification
 * subsystem produced evidence — otherwise the failure state is shown with the
 * reason, never a false success.
 */
export function ResultCard({ task, onNewTask }: { task: TaskDetail; onNewTask: () => void }) {
  const result = task.result;
  if (!result) return null;
  const ok = result.success;

  return (
    <section
      className={`animate-fade-up rounded-2xl border p-4 ${
        ok ? "border-[rgba(45,212,191,0.30)] bg-[var(--color-success-bg)]/[0.07]" : "border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)]/[0.07]"
      }`}
      aria-label="Task result"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-xl border ${
          ok ? "border-[rgba(45,212,191,0.30)] bg-[var(--color-success-bg)] text-[var(--color-success)]"
             : "border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]"}`} aria-hidden>
          {ok ? <IconStar size={19} /> : <IconWarn size={19} />}
        </span>
        <div>
          <h3 className={`text-sm font-semibold ${ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
            {ok ? "Goal completed — verified" : "Goal not verified"}
          </h3>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Duration {durationFrom(task.started_at, task.completed_at)} · {task.current_step} steps ·
            retries {task.retry_count} · confidence {(result.confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-ink-strong)]">{result.summary}</p>

      {result.findings.length > 0 && (
        <div className="mt-4">
          <SectionTitle>Key findings</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-2 text-[12px] text-[var(--color-ink)]">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.links.length > 0 && (
        <div className="mt-4">
          <SectionTitle>Relevant links</SectionTitle>
          <ul className="flex flex-col gap-1">
            {result.links.slice(0, 8).map((l, i) => (
              <li key={i} className="truncate text-[12px]">
                <a href={l} target="_blank" rel="noreferrer noopener" className="text-plasma-400 hover:underline">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.follow_ups.length > 0 && (
        <div className="mt-4">
          <SectionTitle>Needs your follow-up</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {result.follow_ups.map((f, i) => (
              <li key={i} className="text-[12px] text-[var(--color-warning)]/90">→ {f}</li>
            ))}
          </ul>
        </div>
      )}

      {Boolean(result.evidence && (result.evidence as Record<string, unknown>).check) && (
        <p className="mt-3 rounded-xl border border-[var(--color-void-line)] bg-black/20 px-3 py-2 text-[11px] text-[var(--color-ink-muted)]">
          Verification evidence: {String((result.evidence as Record<string, unknown>).check)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip tone={ok ? "good" : "bad"}>{ok ? "evidence-backed" : "insufficient evidence"}</Chip>
        <Link href={`/tasks/${task.id}?tab=activity`} className="btn-ghost text-xs">View activity</Link>
        <button onClick={onNewTask} className="btn-primary text-xs">New task</button>
      </div>
    </section>
  );
}
