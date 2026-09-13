"use client";
/**
 * Chip — a compact status / metadata pill. Three tones: active (accent),
 * neutral, success/warning/danger. Self-sizing so it never stretches.
 */
import type { ReactNode } from "react";
import { statusColor, type Status } from "@/lib/tokens";

interface Props {
  tone?: Status;
  children: ReactNode;
  className?: string;
}

export function Chip({ tone = "neutral", children, className = "" }: Props) {
  const base = "chip";
  const colored =
    tone === "active" ? "chip-active" :
    tone === "success" ? "chip border-[rgba(45,212,191,0.30)] bg-[var(--color-success-bg)]" +
                       " text-[var(--color-success)]" :
    tone === "warning" ? "chip border-[rgba(245,185,79,0.30)] bg-[var(--color-warning-bg)]" +
                       " text-[var(--color-warning)]" :
    tone === "danger"  ? "chip border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)]" +
                       " text-[var(--color-danger)]" :
    "chip";
  return (
    <span
      className={`${colored} ${className}`}
      style={{ color: tone !== "active" && tone !== "success" && tone !== "warning" && tone !== "danger"
        ? statusColor[tone] : undefined }}
    >
      {children}
    </span>
  );
}
