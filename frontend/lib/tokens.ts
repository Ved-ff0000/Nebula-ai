/**
 * TypeScript mirror of globals.css design tokens. Use these for typed
 * access; CSS variables are the runtime source of truth.
 */

export const color = {
  void: "var(--color-void)",
  voidSoft: "var(--color-void-soft)",
  voidPanel: "var(--color-void-panel)",
  voidLine: "var(--color-void-line)",
  voidElevated: "var(--color-void-elevated)",
  ink: "var(--color-ink)",
  inkStrong: "var(--color-ink-strong)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
  accent: "var(--color-accent-500)",
  accentSoft: "var(--color-accent-300)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
} as const;

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
} as const;

export const z = {
  bg: "var(--z-bg)",
  base: "var(--z-base)",
  raised: "var(--z-raised)",
  overlay: "var(--z-overlay)",
  modal: "var(--z-modal)",
  toast: "var(--z-toast)",
} as const;

/** Status → color mapping. The same map drives text, chip, and dot color. */
export type Status =
  | "pending"
  | "active"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export const statusColor: Record<Status, string> = {
  pending: color.inkMuted,
  active: color.accent,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  neutral: color.inkFaint,
};
