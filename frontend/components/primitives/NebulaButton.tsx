"use client";
/**
 * NebulaButton — the only button primitive. Every button in the app uses
 * this so hover, focus, active, disabled, loading, success states are
 * consistent. Tactile, no glow spam, one accent color.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent-500)] text-[var(--color-ink-strong)] " +
    "hover:bg-[var(--color-accent-400)] active:bg-[var(--color-accent-600)] " +
    "border border-[var(--color-accent-600)]",
  secondary:
    "bg-[var(--color-void-soft)] text-[var(--color-ink)] " +
    "hover:bg-[var(--color-void-elevated)] " +
    "border border-[var(--color-void-line)] hover:border-[color:rgba(33,150,243,0.35)]",
  ghost:
    "bg-transparent text-[var(--color-ink-muted)] " +
    "hover:text-[var(--color-ink-strong)] hover:bg-[var(--color-void-soft)] " +
    "border border-transparent",
  danger:
    "bg-[var(--color-danger-bg)] text-[var(--color-danger)] " +
    "hover:bg-[rgba(239,77,107,0.18)] " +
    "border border-[rgba(239,77,107,0.30)]",
};

export const NebulaButton = forwardRef<HTMLButtonElement, Props>(function NebulaButton(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    iconLeft,
    iconRight,
    children,
    className = "",
    ...rest
  },
  ref,
) {
  const reduced = useReducedMotion();
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.08 }}
      disabled={isDisabled}
      className={
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] " +
        "font-medium tracking-[-0.005em] transition-colors " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        sizeClasses[size] + " " + variantClasses[variant] + " " + className
      }
      {...(rest as any)}
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
});
