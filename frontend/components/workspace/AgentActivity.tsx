"use client";
/**
 * AgentActivity — the right-rail live stream of what the agent did,
 * presented as "mission activity" rather than raw event log. Each row
 * animates in when it appears, with a check on done / spinner on current.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, X, Info } from "lucide-react";
import { humaniseLegacyMessage } from "@/lib/format";

export interface ActivityItem {
  id: string;
  type: "plan" | "action" | "navigation" | "result" | "error" | "status";
  status: "running" | "ok" | "warning" | "failed";
  summary: string;
  origin?: string | null;
  ts?: string;
}

interface Props {
  items: ActivityItem[];
}

function iconFor(item: ActivityItem) {
  if (item.status === "running") return <Loader2 className="size-3 animate-spin text-[var(--color-accent-300)]" />;
  if (item.status === "ok")      return <Check className="size-3 text-[var(--color-success)]" />;
  if (item.status === "warning") return <Info className="size-3 text-[var(--color-warning)]" />;
  return <X className="size-3 text-[var(--color-danger)]" />;
}

export function AgentActivity({ items }: Props) {
  const reduced = useReducedMotion();
  return (
    <ul className="space-y-1.5">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.li
            key={it.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[12.5px] text-muted"
          >
            <span className="mt-0.5 grid size-4 place-items-center">
              {iconFor(it)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-strong">
                {humaniseLegacyMessage(it.summary)}
              </div>
              {(it.origin || it.ts) && (
                <div className="mono mt-0.5 text-[10px] text-faint">
                  {it.origin && <span>{shorten(it.origin)}</span>}
                  {it.origin && it.ts && <span> · </span>}
                  {it.ts && <span>{formatTs(it.ts)}</span>}
                </div>
              )}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
      {items.length === 0 && (
        <li className="rounded-[var(--radius-md)] px-2 py-3 text-center text-[12px] text-faint">
          No activity yet. Start a task to see telemetry.
        </li>
      )}
    </ul>
  );
}

function shorten(s: string) {
  return s.replace(/^https?:\/\//, "").replace(/^www\./, "").slice(0, 32);
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
