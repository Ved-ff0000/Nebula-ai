import type { EventStatus, TaskStatus } from "./types";

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function durationFrom(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const s = Math.max(0, Math.round((end - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  CREATED: "Ready",
  PLANNING: "Planning",
  RUNNING: "Running",
  WAITING_FOR_APPROVAL: "Awaiting approval",
  VERIFYING: "Verifying",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  BLOCKED: "Blocked",
};

export const STATUS_TONE: Record<TaskStatus, "idle" | "active" | "good" | "warn" | "bad"> = {
  CREATED: "idle",
  PLANNING: "active",
  RUNNING: "active",
  WAITING_FOR_APPROVAL: "warn",
  VERIFYING: "active",
  COMPLETED: "good",
  FAILED: "bad",
  CANCELLED: "idle",
  BLOCKED: "bad",
};

export const EVENT_TONE: Record<EventStatus, "idle" | "active" | "good" | "warn" | "bad"> = {
  info: "idle",
  success: "good",
  failed: "bad",
  warning: "warn",
  blocked: "bad",
};

export const EVENT_ICON: Record<string, string> = {
  plan: "◇",
  action: "▶",
  verification: "✓",
  security: "⛨",
  approval: "⚑",
  status: "●",
  error: "!",
  result: "★",
  navigation: "→",
};

export function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

export function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
