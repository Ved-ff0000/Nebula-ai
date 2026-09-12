"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/lib/types";
import { IconActivity } from "./icons";
import { EVENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/format";

type Tone = "idle" | "active" | "good" | "warn" | "bad" | "info";

const TONE_CLASS: Record<Tone, string> = {
  idle: "border-white/10 bg-white/[0.05] text-slate-300",
  info: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  active: "border-nebula-400/40 bg-nebula-500/15 text-nebula-100",
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  bad: "border-rose-400/35 bg-rose-400/10 text-rose-200",
};

export function Chip({ tone = "idle", children, className = "" }:
  { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`chip ${TONE_CLASS[tone]} ${className}`}>{children}</span>;
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const tone = STATUS_TONE[status];
  const pulsing = status === "RUNNING" || status === "PLANNING" || status === "VERIFYING";
  return (
    <Chip tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulsing ? "animate-pulse" : ""}`} />
      {STATUS_LABEL[status]}
    </Chip>
  );
}

export function EventTone({ status }: { status: keyof typeof EVENT_TONE }) {
  return <Chip tone={EVENT_TONE[status]}>{status}</Chip>;
}

export function Panel({ children, className = "", strong = false }:
  { children: ReactNode; className?: string; strong?: boolean }) {
  return <div className={`${strong ? "panel-strong" : "panel"} ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint }:
  { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <span className="text-nebula-300/70">{icon ?? <IconActivity size={24} />}</span>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-nebula-400/40 border-t-nebula-300" />
      {label}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundImage: "linear-gradient(90deg,#6d4dfb,#22d3ee)" }}
        />
      </div>
      <span className="font-mono text-[11px] text-slate-400">{value}/{max}</span>
    </div>
  );
}

export function LinkButton({ href, children, className = "" }:
  { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`btn-ghost ${className}`}>
      {children}
    </Link>
  );
}
