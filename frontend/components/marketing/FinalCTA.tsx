"use client";
/**
 * FinalCTA — the closing section. Cinematic, dark, a single line of
 * invitation. Restrained orbital animation in the background.
 */
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  const reduced = useReducedMotion();
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-void-line)] py-32">
      {/* orbital background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: 800, height: 800 }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-full border border-[var(--color-void-line)]" />
        </motion.div>
        <div
          className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(33,150,243,0.10), transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-faint">Ready to explore?</div>
        <h2 className="mt-4 text-5xl font-semibold tracking-[-0.03em] text-strong">
          Give Nebula a mission.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          The browser is yours. The work is Nebula's. You stay the final
          authority.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/tasks">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-5 text-[14px] font-medium tracking-[-0.005em] text-[var(--color-ink-strong)]"
              style={{
                background: "var(--color-accent-500)",
                border: "1px solid var(--color-accent-600)",
              }}
            >
              Launch Nebula
              <ArrowRight className="size-4" />
            </button>
          </Link>
          <Link href="/login">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-5 text-[14px] font-medium tracking-[-0.005em] text-[var(--color-ink-muted)] hover:text-[var(--color-ink-strong)]"
              style={{
                background: "var(--color-void-soft)",
                border: "1px solid var(--color-void-line)",
              }}
            >
              Sign in
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
