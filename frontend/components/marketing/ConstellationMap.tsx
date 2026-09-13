"use client";
/**
 * ConstellationMap — interactive visualisation of the categories of sites
 * Nebula is built to navigate. Nebula sits at the centre; lines extend to
 * category nodes. Hover reveals a description. No 3D; pure SVG.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { fadeUp } from "@/lib/motion";

const NODES = [
  { label: "Search",     x: 50, y: 14, body: "Search engines, indexes, knowledge panels, fact lookups." },
  { label: "Shopping",   x: 86, y: 30, body: "Catalogues, comparison, reviews, availability, pricing." },
  { label: "Research",   x: 92, y: 60, body: "Papers, references, structured data, archives." },
  { label: "Forms",      x: 78, y: 86, body: "Submit, fill, request — always gated behind your approval." },
  { label: "Travel",     x: 50, y: 92, body: "Itineraries, bookings, fare calendars." },
  { label: "Productivity", x: 22, y: 86, body: "Docs, dashboards, internal tools, with credentials you control." },
  { label: "Knowledge",  x: 8,  y: 60, body: "Wikis, encyclopaedias, documentation, transcripts." },
  { label: "Social",     x: 14, y: 30, body: "Public profiles, posts, threads — read-only by default." },
] as const;

export function ConstellationMap() {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const center = { x: 50, y: 50 };

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <header className="mb-12 max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-faint">The web is your universe</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-strong">
          Every category of site, in one constellation.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Nebula navigates the eight kinds of places where work actually
          happens. Hover a node to see what it covers. Lines from the
          centre are the routes it knows how to fly.
        </p>
      </header>

      <div className="surface relative aspect-[5/3] overflow-hidden p-0">
        <svg viewBox="0 0 500 300" className="absolute inset-0 h-full w-full">
          {/* subtle coordinate grid */}
          <g stroke="var(--color-void-line)" strokeWidth="0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={(i + 1) * 50} x2="500" y2={(i + 1) * 50} />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 50} y1="0" x2={(i + 1) * 50} y2="300" />
            ))}
          </g>

          {/* spokes */}
          {NODES.map((n, i) => {
            const active = hover === i;
            return (
              <g key={n.label}>
                <motion.line
                  x1={center.x * 5} y1={center.y * 5}
                  x2={n.x * 5} y2={n.y * 5}
                  stroke={active ? "var(--color-accent-400)" : "var(--color-void-line)"}
                  strokeWidth={active ? 1 : 0.6}
                  animate={
                    reduced
                      ? { opacity: active ? 1 : 0.5 }
                      : { opacity: [0.3, 0.7, 0.3] }
                  }
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    delay: i * 0.25,
                  }}
                />
                <g
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  <motion.circle
                    cx={n.x * 5} cy={n.y * 5} r={active ? 5 : 3}
                    fill={active ? "var(--color-accent-400)" : "var(--color-accent-500)"}
                    animate={reduced ? undefined : {
                      r: active ? [5, 7, 5] : [3, 4, 3],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <text
                    x={n.x * 5 + 8}
                    y={n.y * 5 + 3}
                    fill={active ? "var(--color-ink-strong)" : "var(--color-ink-muted)"}
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    letterSpacing="0.06em"
                  >
                    {n.label.toUpperCase()}
                  </text>
                </g>
              </g>
            );
          })}

          {/* central node */}
          <circle cx={center.x * 5} cy={center.y * 5} r="14" fill="rgba(33,150,243,0.10)" />
          <circle cx={center.x * 5} cy={center.y * 5} r="6" fill="var(--color-accent-400)" />
          <text
            x={center.x * 5} y={center.y * 5 + 22}
            textAnchor="middle"
            fill="var(--color-ink-strong)"
            fontSize="10"
            fontFamily="var(--font-mono)"
            letterSpacing="0.2em"
          >
            NEBULA
          </text>
        </svg>

        {/* hover panel */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex justify-end">
          {hover !== null && (
            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-xs rounded-[var(--radius-md)] bg-[var(--color-void-elevated)] px-3 py-2 text-[12px] text-muted"
            >
              {NODES[hover].body}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
