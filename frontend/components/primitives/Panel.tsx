"use client";
/**
 * Panel — the only "card" component in the app. Solid surface, hairline
 * border, no glassmorphism, no shadow except the 1px inset highlight.
 */
import { motion, useReducedMotion } from "framer-motion";
import type { HTMLAttributes, ReactNode } from "react";
import { durations, easings } from "@/lib/motion";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** When true, fade in slightly when first mounted. */
  appear?: boolean;
}

export function Panel({ children, appear = false, className = "", ...rest }: Props) {
  const reduced = useReducedMotion();
  const Comp: any = appear ? motion.div : "div";
  return (
    <Comp
      initial={appear && !reduced ? { opacity: 0, y: 6 } : false}
      animate={appear && !reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: durations.base, ease: easings.outQuart }}
      className={
        "rounded-[var(--radius-lg)] bg-[var(--color-void-panel)] " +
        "border border-[var(--color-void-line)] " +
        "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] " +
        className
      }
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function PanelHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        "flex items-center justify-between gap-3 border-b border-[var(--color-void-line)] " +
        "px-4 py-3 " + className
      }
    >
      {children}
    </div>
  );
}

export function PanelBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"p-4 " + className}>{children}</div>;
}
