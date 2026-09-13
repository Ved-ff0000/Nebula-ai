/**
 * Motion vocabulary for Nebula. Every animation lives here so the brand has
 * one language. Components use these — they never invent their own timing.
 *
 * Vocabulary (from the brand brief):
 *  - orbit:    elements travel along orbital paths
 *  - signal:   a pulse when Nebula detects a webpage element
 *  - scan:     a thin line moves across the browser viewport
 *  - warp:     a restrained spatial zoom on page transitions
 *  - constellation: completed tasks connect into nodes
 *  - mission complete: a subtle expanding signal
 *
 * Reduced motion is honoured globally in globals.css; these values are the
 * "motion on" path.
 */
import type { Transition, Variants } from "framer-motion";

export const durations = {
  instant: 0.08,
  fast: 0.16,
  base: 0.26,
  slow: 0.46,
  orbit: 14, // seconds, for hero orbit
} as const;

export const easings = {
  outQuart: [0.25, 1, 0.5, 1] as [number, number, number, number],
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOutQuart: [0.76, 0, 0.24, 1] as [number, number, number, number],
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: durations.slow, ease: easings.outExpo },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.base } },
};

export const stagger = (gap = 0.06): Variants => ({
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: gap, delayChildren: 0.05 } },
});

/** Signal — a soft ring expanding outward. Used for "Nebula detected this". */
export const signal: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  pulse: {
    scale: [0.6, 1.6, 2.4],
    opacity: [0.8, 0.3, 0],
    transition: { duration: 1.2, ease: easings.outQuart },
  },
};

/** Warp — a brief spatial zoom for page transitions. */
export const warp: Variants = {
  hidden: { opacity: 0, scale: 0.98, filter: "blur(4px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: durations.base, ease: easings.outExpo },
  },
  exit: {
    opacity: 0,
    scale: 1.02,
    filter: "blur(4px)",
    transition: { duration: durations.fast, ease: easings.inOutQuart },
  },
};

export const baseTransition: Transition = {
  duration: durations.base,
  ease: easings.outQuart,
};
