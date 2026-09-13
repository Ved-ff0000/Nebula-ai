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

/**
 * Legacy failure text written by backends older than the browser-diagnostics
 * fix. Those messages could be literally `Browser unavailable: Browser could
 * not be started:` — nothing after the colon — and they stay in the database
 * forever, so the UI must not render them bare (see docs/BUILD_STATUS.md §5.8).
 *
 * Returns the text unchanged when it is fine, otherwise the same text with the
 * missing detail spelled out and a note that the row predates the fix.
 */
export function humaniseLegacyMessage(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";
  const cutShort =
    /(could not be started|could not start|failed to start)\s*[:：]?\s*$/i.test(raw) ||
    /[:：]\s*$/.test(raw);
  if (!cutShort) return raw;
  const trimmed = raw.replace(/[\s:：]+$/, "");
  const label = /browser could not|browser unavailable/i.test(trimmed) ? "Browser unavailable" : "";
  return [
    label && !/browser unavailable/i.test(trimmed) ? `${label}: ${trimmed}` : trimmed,
    "The reason was not recorded — this entry was written by a backend build older than the "
      + "actionable-diagnostics fix, which printed an empty message when the browser driver "
      + "failed to start. Update to the current build and rerun the task; it will name the "
      + "cause and the exact command that fixes it.",
  ].join(" ");
}

/** True when a stored failure row came from a pre-diagnostics backend build. */
export function looksLikeLegacyBrowserError(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) return false;
  return /browser unavailable\s*[:：]\s*browser could not be started\s*[:：]?\s*$/i.test(raw)
    || /(could not be started|failed to start)\s*[:：]?\s*$/i.test(raw);
}
