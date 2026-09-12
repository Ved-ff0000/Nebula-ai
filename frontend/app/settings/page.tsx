"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentInfo, AllowlistInfo } from "@/lib/types";
import { Chip, Panel, SectionTitle } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [allow, setAllow] = useState<AllowlistInfo | null>(null);
  const [health, setHealth] = useState<{ browser_connected: boolean; llm_provider: string } | null>(null);

  useEffect(() => {
    api.agentInfo().then(setInfo).catch(() => {});
    api.allowlist().then(setAllow).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-light text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Runtime, security boundaries and appearance. Agent policy itself is enforced server-side and is
          intentionally not user-configurable from the browser.
        </p>
      </header>

      <div className="grid gap-4">
        <Panel className="p-5">
          <SectionTitle>Appearance</SectionTitle>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200">Theme</p>
              <p className="text-xs text-slate-500">Deep-space dark (default) or high-contrast light.</p>
            </div>
            <button onClick={toggle} className="btn-ghost">
              {theme === "dark" ? "☾ Dark" : "☀ Light"}
            </button>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle right={<Chip tone={health?.browser_connected ? "good" : "idle"}>
            {health?.browser_connected ? "browser connected" : "browser idle"}
          </Chip>}>
            Agent runtime
          </SectionTitle>
          <dl className="grid gap-3 text-[12px] sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">LLM provider</dt>
              <dd className="mt-1 font-mono text-slate-100">{info?.provider ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">Model</dt>
              <dd className="mt-1 break-all font-mono text-slate-100">{info?.model ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">Max steps / task</dt>
              <dd className="mt-1 font-mono text-slate-100">{info?.limits.max_steps ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">Task time limit</dt>
              <dd className="mt-1 font-mono text-slate-100">
                {info ? `${info.limits.max_task_minutes} minutes` : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">Step timeout</dt>
              <dd className="mt-1 font-mono text-slate-100">
                {info ? `${info.limits.step_timeout_seconds}s` : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-slate-400">Approval timeout</dt>
              <dd className="mt-1 font-mono text-slate-100">
                {info ? `${info.limits.approval_timeout_seconds}s` : "…"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Configure these with environment variables on the backend (NEBULA_LLM_PROVIDER,
            NEBULA_MAX_STEPS, NEBULA_MAX_TASK_MINUTES, NEBULA_STEP_TIMEOUT_SECONDS, …). API keys are
            server-side only and never exposed to this UI.
          </p>
        </Panel>

        <Panel className="p-5">
          <SectionTitle>Domain allowlist</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {(allow?.global_domains ?? []).map((d) => (
              <Chip key={d} tone="active">{d}</Chip>
            ))}
            {!allow && <span className="skeleton h-6 w-40" />}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {allow?.note ??
              "V1 enforces an explicit domain allowlist. Navigation to any other origin is blocked and logged."}
            {" "}You may grant extra domains per task from the composer&apos;s Permissions panel.
          </p>
        </Panel>

        <Panel className="p-5">
          <SectionTitle>Permanently blocked in V1</SectionTitle>
          <ul className="grid gap-2 text-[12px] text-slate-300 sm:grid-cols-2">
            {[
              "Password / credential entry",
              "Financial transactions & purchases",
              "CAPTCHA solving or bypass",
              "Destructive account actions",
              "Arbitrary code or shell execution",
              "Stealth / anti-detection measures",
              "Mass / spam automation",
              "Autonomous message sending",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2">
                <span className="text-rose-300" aria-hidden>⛔</span>
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
