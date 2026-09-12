"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Task, TaskStatus } from "@/lib/types";
import { Chip, Panel, SectionTitle, StatusPill } from "@/components/ui";
import { durationFrom, shortDate, truncate } from "@/lib/format";

const FILTERS: (TaskStatus | "ALL")[] = [
  "ALL", "RUNNING", "WAITING_FOR_APPROVAL", "COMPLETED", "FAILED", "CANCELLED", "BLOCKED",
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      api.listTasks({ q: query || undefined, status: filter === "ALL" ? undefined : filter })
        .then(setTasks)
        .catch(() => setTasks([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, filter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    needsAttention: tasks.filter((t) => ["WAITING_FOR_APPROVAL", "BLOCKED", "FAILED"].includes(t.status)).length,
  }), [tasks]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-white">Task history</h1>
          <p className="mt-1 text-sm text-slate-400">
            {stats.total} task{stats.total === 1 ? "" : "s"} · {stats.completed} completed ·{" "}
            {stats.needsAttention} needing attention
          </p>
        </div>
        <Link href="/" className="btn-primary">＋ New task</Link>
      </header>

      <Panel className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs py-2 text-sm"
            placeholder="Search goals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks"
          />
          <div className="flex flex-wrap items-start gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                  filter === f
                    ? "border-nebula-400/40 bg-nebula-500/20 text-white"
                    : "border-white/10 text-slate-400 hover:text-slate-200"
                }`}
                aria-pressed={filter === f}
              >
                {f === "ALL" ? "All" : f.replaceAll("_", " ").toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <SectionTitle>Results</SectionTitle>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}
          </div>
        ) : tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
            No tasks match this view. Start one from the home screen.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-nebula-400/30 hover:bg-nebula-500/[0.06]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={t.status} />
                    <span className="font-mono text-[10px] text-slate-500">
                      {shortDate(t.created_at)} · {durationFrom(t.started_at, t.completed_at)}
                    </span>
                    {t.retry_count > 0 && <Chip>retries {t.retry_count}</Chip>}
                    <span className="ml-auto font-mono text-[10px] text-slate-500">#{t.id.slice(0, 8)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{truncate(t.goal, 160)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {t.domains.slice(0, 4).map((d) => (
                      <span key={d} className="truncate font-mono text-[10px] text-slate-500">{d}</span>
                    ))}
                  </div>
                  {t.error && <p className="mt-1 text-[11px] text-rose-300/80">{truncate(t.error, 140)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
