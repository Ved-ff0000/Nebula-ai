"use client";
/**
 * BuiltForControl — five states (AI Mode, Pause, Take Control, Confirm,
 * Resume). Each is a tiny animated illustration that mirrors the same
 * states the workspace uses. Trust through visibility.
 */
import { Pause, Hand, ShieldCheck, Play, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const ITEMS = [
  { icon: Sparkles,    title: "AI Mode",     body: "Nebula is acting. You see every action, before and after." },
  { icon: Pause,       title: "Pause",       body: "Hold everything in place. Resume exactly where it stopped." },
  { icon: Hand,        title: "Take Control", body: "Take the wheel. Nebula waits, your inputs are first-class." },
  { icon: ShieldCheck, title: "Confirm",     body: "Before purchases, submissions, and account changes — you approve." },
  { icon: Play,        title: "Resume",      body: "Hand control back. Nebula picks up the mission with full context." },
] as const;

export function BuiltForControl() {
  const reduced = useReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <header className="mb-12 max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-faint">Built for control</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-strong">
          You are always the final authority.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Nebula's safety model is structural: an explicit allowlist of
          domains, a policy engine that classifies risk before each action,
          and a single-action human approval gate for anything that matters.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ITEMS.map(({ icon: Icon, title, body }, i) => (
          <motion.li
            key={title}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="surface p-4"
          >
            <div className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(33,150,243,0.10)] text-[var(--color-accent-300)]">
              <Icon className="size-4" />
            </div>
            <h3 className="mt-4 text-[14px] font-semibold text-strong">{title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{body}</p>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
