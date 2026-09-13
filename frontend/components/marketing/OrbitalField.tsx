"use client";
/**
 * OrbitalField — the brand signature animation. A single luminous point
 * travels along an orbital path, encounters "nodes" (websites) that
 * activate sequentially. Pure SVG + CSS keyframes. Honours
 * prefers-reduced-motion (handled globally in globals.css).
 *
 * The field sits behind the hero text — restrained, not dominant.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

const NODES = [
  // [cx%, cy%, label, delaySeconds]
  [22, 30, "Amazon", 1.2],
  [62, 22, "Flipkart", 3.0],
  [82, 50, "Croma", 4.6],
  [70, 78, "Reliance", 6.2],
  [30, 72, "Vedant", 7.8],
  [12, 56, "Search", 9.4],
] as const;

export function OrbitalField() {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {/* faint background grid */}
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-60"
      >
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="var(--color-accent-500)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-trail`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* central nebula glow */}
        <circle cx="400" cy="300" r="120" fill={`url(#${id}-glow)`} />

        {/* orbital rings */}
        <ellipse cx="400" cy="300" rx="320" ry="120" fill="none"
          stroke="var(--color-void-line)" strokeWidth="1" opacity="0.7"
          transform="rotate(-12 400 300)" />
        <ellipse cx="400" cy="300" rx="220" ry="80" fill="none"
          stroke="var(--color-void-line)" strokeWidth="1" opacity="0.4"
          transform="rotate(-12 400 300)" />

        {/* nodes */}
        {NODES.map(([cx, cy, label, delay], i) => (
          <g key={i}>
            <motion.circle
              cx={(cx / 100) * 800}
              cy={(cy / 100) * 600}
              r="3"
              fill="var(--color-accent-400)"
              initial={{ opacity: 0.2 }}
              animate={
                reduced
                  ? { opacity: 0.4 }
                  : { opacity: [0.2, 1, 0.5] }
              }
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "mirror",
                delay: delay,
              }}
            />
            <text
              x={(cx / 100) * 800 + 8}
              y={(cy / 100) * 600 + 3}
              fill="var(--color-ink-faint)"
              fontSize="10"
              fontFamily="var(--font-mono)"
              letterSpacing="0.05em"
            >
              {label.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>

      {/* the traveller — a luminous point that follows the outer orbit */}
      {!reduced && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: 600, height: 200, transformOrigin: "center" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
            style={{
              background: "var(--color-accent-400)",
              boxShadow:
                "0 0 12px rgba(33,150,243,0.9), 0 0 32px rgba(33,150,243,0.4)",
            }}
          />
          <div
            className="absolute right-0 top-1/2 h-[1px] -translate-y-1/2 rounded-full"
            style={{
              width: 80,
              transform: "translateX(-100%)",
              background:
                "linear-gradient(90deg, transparent, rgba(33,150,243,0.9))",
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
