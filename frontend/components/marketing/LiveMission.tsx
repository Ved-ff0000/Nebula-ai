"use client";
/**
 * LiveMission — the scripted, deterministic "live" demo on the landing
 * page. Plays a fixed mission timeline with timed states so it looks
 * identical every reload. The same vocabulary (telemetry) is reused in
 * the real workspace for live tasks, so the brand is consistent.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";

const STEPS = [
  { id: "understand", label: "Task understood", duration: 900 },
  { id: "plan",       label: "Search strategy prepared", duration: 1200 },
  { id: "amazon",     label: "Amazon scanned", duration: 1300 },
  { id: "flipkart",   label: "Flipkart scanned", duration: 1200 },
  { id: "compare",    label: "Comparing results", duration: 1800, active: true },
  { id: "result",     label: "Returning results", duration: 1200 },
  { id: "complete",   label: "Task complete", duration: 0 },
] as const;

type State = "pending" | "active" | "done";

function useMission() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (idx >= STEPS.length - 1) return;
    const t = setTimeout(() => setIdx(idx + 1), STEPS[idx].duration);
    return () => clearTimeout(t);
  }, [idx]);
  const stateOf = (i: number): State =>
    i < idx ? "done" : i === idx ? "active" : "pending";
  return { idx, stateOf, total: STEPS.length };
}

export function LiveMission({ className = "" }: { className?: string }) {
  const { idx, stateOf, total } = useMission();
  const reduced = useReducedMotion();
  const progress = Math.min(100, Math.round(((idx + 1) / total) * 100));
  return (
    <div
      className={
        "surface-soft p-5 " + className
      }
      aria-label="Mission activity"
    >
      <header className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-faint">
        <span>Mission Activity</span>
        <span className="mono">{progress}%</span>
      </header>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-void-line)]">
        <motion.div
          className="h-full"
          style={{
            background:
              "linear-gradient(90deg, var(--color-accent-500), var(--color-accent-300))",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <ol className="mt-4 space-y-1.5">
        {STEPS.map((s, i) => {
          const state = stateOf(i);
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-[13px]"
              style={{
                color:
                  state === "done"   ? "var(--color-ink-strong)" :
                  state === "active" ? "var(--color-accent-200)" :
                                       "var(--color-ink-faint)",
                background:
                  state === "active" ? "rgba(33,150,243,0.06)" : "transparent",
              }}
            >
              <span className="grid size-4 place-items-center">
                <AnimatePresence mode="wait" initial={false}>
                  {state === "done" && (
                    <motion.span
                      key="done"
                      initial={reduced ? { opacity: 1 } : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="grid size-4 place-items-center rounded-full"
                      style={{
                        background: "var(--color-success-bg)",
                        color: "var(--color-success)",
                      }}
                    >
                      <Check className="size-2.5" />
                    </motion.span>
                  )}
                  {state === "active" && (
                    <motion.span
                      key="active"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid size-4 place-items-center text-[var(--color-accent-300)]"
                    >
                      <Loader2 className="size-3 animate-spin" />
                    </motion.span>
                  )}
                  {state === "pending" && (
                    <Circle className="size-2.5 text-[var(--color-ink-faint)]" />
                  )}
                </AnimatePresence>
              </span>
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
