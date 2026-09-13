"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentInfo, AllowlistInfo, BrowserDiagnostics } from "@/lib/types";
import { Chip, Panel, SectionTitle } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [allow, setAllow] = useState<AllowlistInfo | null>(null);
  const [health, setHealth] = useState<{
    browser_connected: boolean; llm_provider: string;
    browser?: { driver_running: boolean; environment_ok: boolean; installed: boolean;
                problem: string | null; remedy: string | null };
  } | null>(null);
  const [diag, setDiag] = useState<BrowserDiagnostics | null>(null);

  useEffect(() => {
    api.agentInfo().then(setInfo).catch(() => {});
    api.allowlist().then(setAllow).catch(() => {});
    api.health().then(setHealth).catch(() => {});
    api.browserDiagnostics().then(setDiag).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-light text-white">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Runtime, security boundaries and appearance. Agent policy itself is enforced server-side and is
          intentionally not user-configurable from the browser.
        </p>
      </header>

      <div className="grid gap-4">
        <Panel className="p-5">
          <SectionTitle>Appearance</SectionTitle>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--color-ink)]">Theme</p>
              <p className="text-xs text-[var(--color-ink-faint)]">Deep-space dark (default) or high-contrast light.</p>
            </div>
            <button onClick={toggle} className="btn-ghost">
              {theme === "dark" ? "☾ Dark" : "☀ Light"}
            </button>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle right={
            <Chip tone={diag ? (diag.ok ? "good" : "bad") : "idle"}>
              {diag
                ? diag.ok
                  ? health?.browser_connected ? "browser running" : "browser ready"
                  : "browser not ready"
                : "checking…"}
            </Chip>
          }>
            Agent runtime
          </SectionTitle>

          {diag && !diag.ok && (
            <div className="mb-4 rounded-xl border border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)]/[0.07] p-3">
              <p className="text-[12px] text-[var(--color-danger)]">{diag.problem}</p>
              {diag.remedy && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-[var(--color-void-line)] bg-black/40 px-3 py-2 font-mono text-[11px] text-[var(--color-success)]">
                    {diag.remedy}
                  </code>
                </div>
              )}
              <p className="mt-2 text-[11px] text-[var(--color-danger)]/80">
                Run that command, then start a task again — or use the diagnostics panel on a failed
                task page to re-test the browser in place.
              </p>
            </div>
          )}
          <dl className="grid gap-3 text-[12px] sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">LLM provider</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">{info?.provider ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Model</dt>
              <dd className="mt-1 break-all font-mono text-[var(--color-ink-strong)]">{info?.model ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Max steps / task</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">{info?.limits.max_steps ?? "…"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Task time limit</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">
                {info ? `${info.limits.max_task_minutes} minutes` : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Step timeout</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">
                {info ? `${info.limits.step_timeout_seconds}s` : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Chromium binary</dt>
              <dd className={`mt-1 font-mono ${diag?.browser_installed ? "text-[var(--color-ink-strong)]" : "text-[var(--color-danger)]"}`}>
                {diag ? (diag.browser_installed ? "found" : "not found") : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Approval timeout</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">
                {info ? `${info.limits.approval_timeout_seconds}s` : "…"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--color-void-line)] bg-[var(--color-void-soft)] p-3">
              <dt className="text-[var(--color-ink-muted)]">Backend build</dt>
              <dd className="mt-1 font-mono text-[var(--color-ink-strong)]">
                {diag?.build ? (
                  <>
                    {diag.build.commit}
                    {diag.build.dirty && <span className="text-[var(--color-warning)]"> + uncommitted</span>}
                    <span className="text-[var(--color-ink-faint)]"> · diagnostics rev {diag.build.diagnostics_revision}</span>
                  </>
                ) : diag ? (
                  <span className="text-[var(--color-warning)]">unknown (older backend)</span>
                ) : (
                  "…"
                )}
              </dd>
            </div>
          </dl>

          {diag && !diag.build?.features?.includes("actionable_launch_errors") && (
            <div className="mt-3 rounded-xl border border-[rgba(245,185,79,0.30)] bg-[var(--color-warning-bg)] p-3 text-[12px] text-[var(--color-warning)]">
              <p className="font-semibold">This backend is older than the diagnostics fix</p>
              <p className="mt-1 leading-relaxed">
                The running process does not report its build identity, so it predates the actionable
                browser-launch errors. Tasks that fail to start a browser on this build can show an empty
                reason (for example <span className="font-mono">Browser could not be started:</span> with
                nothing after the colon). Update the code, then <strong>restart the backend</strong> —
                restarting the process is what loads the new code.
              </p>
              <p className="mt-1 font-mono text-[11px] opacity-90">
                git pull &amp;&amp; (docker compose up -d --build | restart uvicorn)
              </p>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
            Configure these with environment variables on the backend (NEBULA_LLM_PROVIDER,
            NEBULA_MAX_STEPS, NEBULA_MAX_TASK_MINUTES, NEBULA_STEP_TIMEOUT_SECONDS, …). API keys are
            server-side only and never exposed to this UI.
          </p>
        </Panel>

        <Panel className="p-5">
          <SectionTitle>Domain allowlist</SectionTitle>
          <div className="flex flex-wrap items-start gap-2">
            {(allow?.global_domains ?? []).map((d) => (
              <Chip key={d} tone="active">{d}</Chip>
            ))}
            {!allow && <span className="skeleton h-6 w-40" />}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
            {allow?.note ??
              "V1 enforces an explicit domain allowlist. Navigation to any other origin is blocked and logged."}
            {" "}You may grant extra domains per task from the composer&apos;s Permissions panel.
          </p>
        </Panel>

        <Panel className="p-5">
          <SectionTitle>Permanently blocked in V1</SectionTitle>
          <ul className="grid gap-2 text-[12px] text-[var(--color-ink-muted)] sm:grid-cols-2">
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
              <li key={item} className="flex items-center gap-2 rounded-xl border border-[rgba(239,77,107,0.20)] bg-[var(--color-danger-bg)]/[0.06] px-3 py-2">
                <span className="text-[var(--color-danger)]" aria-hidden>⛔</span>
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
