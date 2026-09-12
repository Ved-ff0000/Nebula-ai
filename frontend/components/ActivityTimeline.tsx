"use client";

import type { TaskEvent } from "@/lib/types";
import { clockTime, ms, originOf } from "@/lib/format";
import { Chip, EmptyState } from "./ui";
import {
  IconActivity, IconArrowRight, IconCheck, IconDot, IconFlag, IconPlan,
  IconShield, IconStar, IconWarn,
} from "./icons";

/** Event-type glyphs (inline SVG — no emoji/font dependency). */
function EventGlyph({ type }: { type: string }) {
  const size = 14;
  switch (type) {
    case "plan": return <IconPlan size={size} />;
    case "action": return <IconArrowRight size={size} />;
    case "verification": return <IconCheck size={size} />;
    case "security": return <IconShield size={size} />;
    case "approval": return <IconFlag size={size} />;
    case "error": return <IconWarn size={size} />;
    case "result": return <IconStar size={size} />;
    case "navigation": return <IconArrowRight size={size} />;
    case "status": return <IconActivity size={size} />;
    default: return <IconDot size={size} />;
  }
}

const TONE: Record<string, string> = {
  info: "border-white/15 text-slate-300",
  success: "border-emerald-400/40 text-emerald-300",
  failed: "border-rose-400/40 text-rose-300",
  warning: "border-amber-400/40 text-amber-300",
  blocked: "border-rose-500/60 text-rose-200",
};

/**
 * Audit-style activity timeline. Every entry is an observable action/decision —
 * NEBULA never displays hidden reasoning, system prompts or model thoughts.
 */
export function ActivityTimeline({ events, dense = false }: { events: TaskEvent[]; dense?: boolean }) {
  if (!events.length) {
    return <EmptyState title="No activity yet" hint="Events appear here as the agent works." />;
  }
  const ordered = [...events].reverse();

  return (
    <ol className={`flex flex-col ${dense ? "gap-1.5" : "gap-2.5"}`} aria-label="Activity timeline">
      {ordered.map((e) => (
        <li key={e.id} className="relative animate-fade-up rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${TONE[e.status] ?? TONE.info}`}
              aria-hidden
            >
              <EventGlyph type={e.type} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-slate-200">{e.summary}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                <span className="font-mono">{clockTime(e.timestamp)}</span>
                <span className="uppercase tracking-[0.18em]">{e.type}</span>
                {e.origin && <span className="truncate">{originOf(e.origin)}</span>}
                {typeof e.duration_ms === "number" && <span className="font-mono">{ms(e.duration_ms)}</span>}
                {e.status !== "info" && (
                  <Chip tone={e.status === "success" ? "good" : e.status === "failed" || e.status === "blocked" ? "bad" : "warn"}>
                    {e.status}
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
