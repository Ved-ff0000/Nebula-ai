"use client";
/**
 * TakeoverPanel — the "Nebula needs your help with this page" affordance
 * and the "you have control" state. Single primary action in each mode.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Hand } from "lucide-react";
import { NebulaButton } from "@/components/primitives/NebulaButton";

interface Props {
  mode: "ask" | "active" | "resumed";
  onTake?: () => void;
  onReturn?: () => void;
}

export function TakeoverPanel({ mode, onTake, onReturn }: Props) {
  const reduced = useReducedMotion();
  if (mode === "active") {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface border-[rgba(245,185,79,0.30)]"
        style={{ background: "var(--color-warning-bg)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Hand className="size-4 text-[var(--color-warning)]" />
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warning)]">
                User control active
              </div>
              <div className="text-[13px] text-strong">
                Nebula is paused while you drive.
              </div>
            </div>
          </div>
          <NebulaButton variant="secondary" size="sm" onClick={onReturn}>
            Give control back
          </NebulaButton>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Hand className="size-4 text-[var(--color-accent-300)]" />
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
              User action required
            </div>
            <div className="text-[13px] text-strong">
              Nebula needs your help with this page.
            </div>
          </div>
        </div>
        <NebulaButton variant="primary" size="sm" onClick={onTake}>
          Take control
        </NebulaButton>
      </div>
    </motion.div>
  );
}
