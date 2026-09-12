"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/lib/types";
import { Chip, Panel, SectionTitle } from "@/components/ui";
import { clockTime, EVENT_ICON, originOf, shortDate } from "@/lib/format";

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "security" | "approval" | "action">("all");

  useEffect(() => {
    const load = () => api.activity().then(setItems).catch(() => {}).finally(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const visible = filter === "all"
    ? items
    : items.filter((i) => (filter === "security" ? i.type === "security" || i.status === "blocked"
      : filter === "approval" ? i.type === "approval"
      : i.type === "action"));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-light text-white">Activity</h1>
        <p className="mt-1 text-sm text-slate-400">
          A real-time audit trail across every task. Only observable actions and decisions are recorded —
          never hidden reasoning.
        </p>
      </header>

      <Panel className="p-4">
        <div className="mb-4 flex flex-wrap items-start gap-1">
          {(["all", "action", "security", "approval"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] capitalize transition ${
                filter === f ? "border-nebula-400/40 bg-nebula-500/20 text-white"
                             : "border-white/10 text-slate-400 hover:text-slate-200"
              }`}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}</div>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {visible.map((item, idx) => (
              <li key={`${item.task_id}-${idx}`} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 text-sm text-nebula-300" aria-hidden>{EVENT_ICON[item.type] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-200">{item.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span className="font-mono">{clockTime(item.timestamp)}</span>
                    <span>{shortDate(item.timestamp)}</span>
                    {item.origin && <span className="truncate">{originOf(item.origin)}</span>}
                    <Link href={`/tasks/${item.task_id}`} className="text-nebula-300 hover:underline">
                      #{item.task_id.slice(0, 8)}
                    </Link>
                    {item.status !== "info" && (
                      <Chip tone={item.status === "success" ? "good" : item.status === "warning" ? "warn" : "bad"}>
                        {item.status}
                      </Chip>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
