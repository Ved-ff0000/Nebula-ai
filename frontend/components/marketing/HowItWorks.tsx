"use client";
/**
 * HowItWorks — three stages: Understand, Navigate, Complete. Scroll-triggered
 * using Framer's `whileInView`. Each stage has a small SVG diagram that
 * matches the vocabulary (orbit, signal, constellation).
 */
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Globe2, CheckCircle2 } from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";

const STAGES = [
  {
    n: "01",
    icon: Compass,
    title: "Understand",
    body:
      "Nebula reads your goal as a mission brief — not a chat message. " +
      "It pulls out constraints, success criteria, and the smallest set of " +
      "sites that could answer it.",
  },
  {
    n: "02",
    icon: Globe2,
    title: "Navigate",
    body:
      "An on-device browser opens the right pages, reads their structure, " +
      "and interacts with them through a structured eight-tool vocabulary. " +
      "Every action is policy-checked and observable.",
  },
  {
    n: "03",
    icon: CheckCircle2,
    title: "Complete",
    body:
      "When the goal can be verified, Nebula closes the loop with evidence. " +
      "When it can't, it tells you exactly why — and what it needs to finish.",
  },
];

export function HowItWorks() {
  const reduced = useReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <header className="mb-12">
        <div className="text-[11px] uppercase tracking-[0.22em] text-faint">How Nebula works</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-strong">
          Three stages, one loop.
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
          Every mission is observe → reason → plan → act → verify, repeated
          until the goal is either satisfied or honestly blocked. Nothing
          happens that you can't see.
        </p>
      </header>

      <motion.ol
        variants={stagger(0.12)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="grid gap-4 md:grid-cols-3"
      >
        {STAGES.map(({ n, icon: Icon, title, body }) => (
          <motion.li
            key={n}
            variants={reduced ? undefined : fadeUp}
            className="surface p-6"
          >
            <div className="flex items-center justify-between">
              <span className="mono text-[11px] text-faint">{n}</span>
              <Icon className="size-4 text-[var(--color-accent-300)]" />
            </div>
            <h3 className="mt-6 text-lg font-semibold tracking-[-0.01em] text-strong">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
