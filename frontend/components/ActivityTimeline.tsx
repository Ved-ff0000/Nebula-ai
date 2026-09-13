"use client";

import type { TaskEvent } from "@/lib/types";
import { clockTime, humaniseLegacyMessage, ms, originOf } from "@/lib/format";
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
  info: "border-white/15 text-[var(--color-ink-muted)]",
  success: "border-[rgba(45,212,191,0.30)] text-[var(--color-success)]",
  failed: "border-[rgba(239,77,107,0.30)] text-[var(--color-danger)]",
  warning: "border-[rgba(245,185,79,0.30)] text-[var(--color-warning)]",
  blocked: "border-[rgba(239,77,107,0.30)] text-[var(--color-danger)]",
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
        <li key={e.id} className="relative animate-fade-up rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${TONE[e.status] ?? TONE.info}`}
              aria-hidden
            >
              <EventGlyph type={e.type} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-[var(--color-ink)]">{humaniseLegacyMessage(e.summary)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-ink-faint)]">
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
