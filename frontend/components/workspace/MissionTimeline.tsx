"use client";
/**
 * MissionTimeline — a thin, vertical timeline showing each stage of the
 * current mission. Animates as stages complete. Used in the right rail.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import type { TaskStatus } from "@/lib/types";

interface Stage {
  id: string;
  label: string;
}

const DEFAULT_STAGES: Stage[] = [
  { id: "understand", label: "Understand request" },
  { id: "plan",       label: "Build plan" },
  { id: "browse",     label: "Browse web" },
  { id: "collect",    label: "Collect information" },
  { id: "compare",    label: "Compare results" },
  { id: "complete",   label: "Complete task" },
];

function stageIndexFor(status: TaskStatus, currentStep: number): number {
  switch (status) {
    case "CREATED":            return 0;
    case "PLANNING":           return 1;
    case "RUNNING":            return Math.min(2 + Math.floor(currentStep / 3), 4);
    case "VERIFYING":          return 4;
    case "WAITING_FOR_APPROVAL": return 3;
    case "COMPLETED":          return 5;
    case "FAILED":
    case "CANCELLED":
    case "BLOCKED":            return 5;
    default:                   return 0;
  }
}

export function MissionTimeline({
  status, currentStep, stages = DEFAULT_STAGES,
}: { status: TaskStatus; currentStep: number; stages?: Stage[] }) {
  const reduced = useReducedMotion();
  const active = stageIndexFor(status, currentStep);
  const isTerminal = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" || status === "BLOCKED";

  return (
    <ol className="relative ml-2 mt-2 space-y-3">
      {/* the spine */}
      <div className="absolute left-3 top-1 bottom-1 w-px bg-[var(--color-void-line)]" />
      {stages.map((s, i) => {
        const done = i < active || (isTerminal && status === "COMPLETED" && i <= active);
        const current = i === active && !isTerminal;
        return (
          <li key={s.id} className="relative flex items-center gap-3 pl-1">
            <span className="z-10 grid size-6 place-items-center rounded-full bg-[var(--color-void-panel)]">
              {done ? (
                <span
                  className="grid size-4 place-items-center rounded-full"
                  style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
                >
                  <Check className="size-2.5" />
                </span>
              ) : current ? (
                <motion.span
                  className="grid size-4 place-items-center rounded-full text-[var(--color-accent-300)]"
                  animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  <Loader2 className="size-3 animate-spin" />
                </motion.span>
              ) : (
                <Circle className="size-2.5 text-faint" />
              )}
            </span>
            <span
              className={
                "text-[13px] " +
                (done ? "text-muted" : current ? "text-strong" : "text-faint")
              }
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
