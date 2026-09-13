"use client";
/**
 * BrowserViewport — an embedded browser lookalike. URL bar, nav buttons,
 * optional AI cursor overlay that points at the element Nebula is
 * targeting, an optional "scan" effect when reading a page. Real browser
 * frame served from /api/browser/{task_id}?snapshot=N when available;
 * falls back to a synthetic frame so the UI is always meaningful.
 */
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCw, MoreHorizontal } from "lucide-react";

interface Props {
  url?: string;
  title?: string;
  status?: "idle" | "navigating" | "reading" | "interacting";
  targetLabel?: string | null; // element Nebula is acting on
  snapshotUrl?: string | null;
}

export function BrowserViewport({
  url = "",
  title = "Idle",
  status = "idle",
  targetLabel = null,
  snapshotUrl = null,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="surface overflow-hidden">
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-2">
        <div className="flex items-center gap-1 text-faint">
          <button aria-label="Back"    className="grid size-6 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--color-void-elevated)] hover:text-strong">
            <ArrowLeft className="size-3" />
          </button>
          <button aria-label="Forward" className="grid size-6 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--color-void-elevated)] hover:text-strong">
            <ArrowRight className="size-3" />
          </button>
          <button aria-label="Reload"  className="grid size-6 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--color-void-elevated)] hover:text-strong">
            <RotateCw className="size-3" />
          </button>
        </div>
        <div className="ml-1 flex flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void)] px-3 py-1.5 text-[12px] text-muted">
          <span className="mono text-faint">⏺</span>
          <span className="truncate">{url || "nebula://idle"}</span>
        </div>
        <button aria-label="More" className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-faint hover:bg-[var(--color-void-elevated)] hover:text-strong">
          <MoreHorizontal className="size-3" />
        </button>
      </div>

      {/* page */}
      <div className="relative aspect-[16/10] w-full bg-[var(--color-void)]">
        {snapshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshotUrl} alt={title} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <SyntheticFrame status={status} targetLabel={targetLabel} title={title} reduced={!!reduced} />
        )}

        {/* AI cursor overlay */}
        {targetLabel && (
          <motion.div
            className="pointer-events-none absolute right-[34%] top-[40%]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-[var(--radius-md)]"
                style={{
                  border: "1.5px solid var(--color-accent-400)",
                  boxShadow: "0 0 12px rgba(33,150,243,0.45)",
                }}
              />
              <div
                className="absolute left-1/2 top-full -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-accent-500)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-strong)]"
              >
                Nebula target · {targetLabel}
              </div>
            </div>
          </motion.div>
        )}

        {/* scan effect when reading */}
        {status === "reading" && !reduced && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <div
              className="h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--color-accent-400), transparent)",
                animation: "nebula-scan 1.6s linear infinite",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SyntheticFrame({
  status, targetLabel, title, reduced,
}: { status: string; targetLabel: string | null; title: string; reduced: boolean }) {
  return (
    <div className="absolute inset-0 p-6 text-[12px] text-muted">
      <div className="mono mb-3 text-[10px] uppercase tracking-[0.18em] text-faint">
        {title}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-2/3 rounded-full bg-[var(--color-void-line)]" />
        <div className="h-3 w-1/2 rounded-full bg-[var(--color-void-line)]" />
        <div className="h-3 w-3/5 rounded-full bg-[var(--color-void-line)]" />
      </div>

      {/* simulated cards */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3"
          >
            <div className="h-2.5 w-3/4 rounded-full bg-[var(--color-void-line)]" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-[var(--color-void-line)]" />
            <div className="mt-4 h-12 rounded-[var(--radius-sm)] bg-[var(--color-void)]" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 text-[10px] text-faint">
        <span className="mono">status: {status}</span>
        {targetLabel && (
          <span className="mono">target: {targetLabel}</span>
        )}
      </div>

      {!reduced && status === "navigating" && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0, 0.04, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ background: "var(--color-accent-500)" }}
        />
      )}
    </div>
  );
}
