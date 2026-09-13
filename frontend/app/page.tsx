/**
 * Landing page. Cinematic, dark, restrained. The orbital field sits
 * behind the hero; "Live Mission" plays a deterministic timeline so the
 * demo is brand-safe and identical every time.
 *
 * Sections (in order):
 *  1. Hero (orbital field + headline + CTAs)
 *  2. Live Mission (scripted telemetry demo)
 *  3. How It Works (Understand → Navigate → Complete)
 *  4. The Web Is Your Universe (constellation map)
 *  5. Built for Control (5 trust states)
 *  6. Final CTA
 */
import { OrbitalField } from "@/components/marketing/OrbitalField";
import { LiveMission } from "@/components/marketing/LiveMission";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { ConstellationMap } from "@/components/marketing/ConstellationMap";
import { BuiltForControl } from "@/components/marketing/BuiltForControl";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative">
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden pt-28 pb-20">
        <OrbitalField />

        <div className="relative mx-auto max-w-5xl px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-1 text-[11px] tracking-[0.12em] text-muted">
            <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
            MISSION CONTROL · V1
          </div>

          <h1 className="mt-8 text-6xl font-semibold tracking-[-0.04em] text-strong sm:text-7xl">
            NEBULA
          </h1>

          <p className="mt-3 max-w-2xl text-[20px] leading-snug tracking-[-0.01em] text-strong">
            One AI. Every Website.
          </p>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Give Nebula a task. It navigates the web, understands what it
            sees, and gets the work done — with a policy engine that asks
            you before anything consequential.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
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
            <a href="#live-mission">
              <button
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-5 text-[14px] font-medium tracking-[-0.005em] text-[var(--color-ink-muted)] hover:text-[var(--color-ink-strong)]"
                style={{
                  background: "var(--color-void-soft)",
                  border: "1px solid var(--color-void-line)",
                }}
              >
                <Play className="size-3.5" />
                See how it works
              </button>
            </a>
          </div>

          <div className="mt-16 grid gap-3 text-[12px] text-faint sm:grid-cols-3">
            <div className="surface-soft px-3 py-2">
              <span className="mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Eight structured tools
              </span>
              <p className="mt-1 text-strong">
                navigate · go_back · read_page · screenshot · click · type · scroll · wait_for_load
              </p>
            </div>
            <div className="surface-soft px-3 py-2">
              <span className="mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Policy before action
              </span>
              <p className="mt-1 text-strong">
                Allowlist · risk · single-action approval · prompt-injection defence
              </p>
            </div>
            <div className="surface-soft px-3 py-2">
              <span className="mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Verifiable results
              </span>
              <p className="mt-1 text-strong">
                Every completed task ships with evidence, not a claim.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== LIVE MISSION ============================== */}
      <section id="live-mission" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-faint">
              Live mission
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-strong">
              A real mission, telemetry, no filler.
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-muted">
              Below is the mission activity panel from a Nebula task
              running in real time. The status of each step is the only
              thing you see — never chain-of-thought, never internal
              reasoning. Each stage animates in once it completes.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-2 text-[12px] text-muted">
              <span className="mono text-[10px] uppercase tracking-[0.16em] text-faint">
                TASK
              </span>
              <span className="text-strong">Find RTX 4060 laptops under ₹80,000</span>
            </div>
          </div>

          <LiveMission />
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <HowItWorks />

      {/* ============================== CONSTELLATION ============================== */}
      <ConstellationMap />

      {/* ============================== BUILT FOR CONTROL ============================== */}
      <BuiltForControl />

      {/* ============================== FINAL CTA ============================== */}
      <FinalCTA />

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-[var(--color-void-line)] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-[11px] text-faint">
          <div className="mono tracking-[0.16em]">NEBULA · V1</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-strong">Sign in</Link>
            <Link href="/tasks" className="hover:text-strong">Tasks</Link>
            <Link href="/settings" className="hover:text-strong">Settings</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
