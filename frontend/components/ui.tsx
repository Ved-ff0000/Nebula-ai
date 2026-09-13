"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/lib/types";
import { IconActivity } from "./icons";
import { EVENT_TONE, STATUS_LABEL, STATUS_TONE } from "@/lib/format";

type Tone = "idle" | "active" | "good" | "warn" | "bad" | "info";

const TONE_CLASS: Record<Tone, string> = {
  idle: "border-[var(--color-void-line)] bg-[var(--color-void-soft)] text-[var(--color-ink-muted)]",
  info: "border-[rgba(33,150,243,0.30)] bg-[rgba(33,150,243,0.10)] text-[var(--color-accent-200)]",
  active: "border-[rgba(33,150,243,0.35)] bg-[rgba(33,150,243,0.10)] text-[var(--color-accent-200)]",
  good: "border-[rgba(45,212,191,0.30)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
  warn: "border-[rgba(245,185,79,0.30)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  bad: "border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
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
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint }:
  { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <span className="text-[var(--color-accent-300)]/70">{icon ?? <IconActivity size={24} />}</span>
      <p className="text-sm font-medium text-[var(--color-ink-muted)]">{title}</p>
      {hint && <p className="max-w-sm text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(33,150,243,0.35)] border-t-nebula-300" />
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
      <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">{value}/{max}</span>
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
