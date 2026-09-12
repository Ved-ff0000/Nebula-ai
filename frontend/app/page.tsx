"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { NebulaMark, NebulaWordmark } from "@/components/NebulaLogo";
import { TaskComposer } from "@/components/TaskComposer";
import { Chip, Panel, SectionTitle } from "@/components/ui";
import type { AgentInfo, Task } from "@/lib/types";
import { STATUS_LABEL, STATUS_TONE, timeAgo, truncate } from "@/lib/format";

export default function HomePage() {
  const [recent, setRecent] = useState<Task[]>([]);
  const [info, setInfo] = useState<AgentInfo | null>(null);

  useEffect(() => {
    api.listTasks().then((t) => setRecent(t.slice(0, 4))).catch(() => {});
    api.agentInfo().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-14">
      <header className="flex flex-col items-center text-center">
        <NebulaMark size={64} />
        <h1 className="mt-4">
          <NebulaWordmark className="block text-3xl text-white sm:text-4xl" />
          <span className="mt-3 block text-xl font-light text-slate-300 sm:text-2xl">
            Give the web a goal.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
          NEBULA understands what you want to accomplish, navigates real websites in a sandboxed
          browser, gathers information and performs permitted actions — while a risk engine reviews
          every step and <span className="text-slate-200">you stay the final authority</span> for
          consequential decisions.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Chip tone="active">policy-checked actions</Chip>
          <Chip tone="warn">approval before anything consequential</Chip>
          <Chip tone="bad">credentials & payments blocked</Chip>
          <Chip tone="good">evidence-verified results</Chip>
        </div>
      </header>

      <div className="mt-8">
        <TaskComposer autoFocus />
      </div>

      {recent.length > 0 && (
        <section className="mt-12">
          <SectionTitle
            right={
              <Link href="/tasks" className="text-[11px] text-nebula-300 hover:underline">
                all tasks →
              </Link>
            }
          >
            Continue where you left off
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="panel block p-4 transition hover:border-nebula-400/40">
                <div className="flex items-center justify-between gap-2">
                  <Chip tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Chip>
                  <span className="font-mono text-[10px] text-slate-500">{timeAgo(t.updated_at)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-200">{truncate(t.goal, 120)}</p>
                {t.domains.length > 0 && (
                  <p className="mt-2 truncate font-mono text-[10px] text-slate-500">{t.domains.join(" · ")}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="p-5">
          <SectionTitle>How NEBULA works</SectionTitle>
          <ol className="flex flex-col gap-3 text-[13px] text-slate-300">
            {[
              ["Plan", "Your goal becomes a short, inspectable plan — no hidden reasoning is ever shown."],
              ["Observe", "Structured page state: URL, origin, title, interactive elements and text."],
              ["Decide", "The model proposes one granular tool call per step, validated against schemas."],
              ["Policy", "The risk engine classifies it LOW / MEDIUM / HIGH / BLOCKED. The model can never override it."],
              ["Approve", "HIGH-risk actions pause the browser until you approve that single action."],
              ["Verify", "Success is only claimed when observations provide evidence it actually happened."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-nebula-400/30 bg-nebula-500/10 text-[11px] text-nebula-200">
                  {i + 1}
                </span>
                <span>
                  <strong className="text-slate-100">{title}.</strong> {body}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel className="p-5">
          <SectionTitle>Runtime</SectionTitle>
          <dl className="flex flex-col gap-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Agent brain</dt>
              <dd className="text-right font-mono text-slate-200">
                {info ? `${info.provider} · ${info.model}` : "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Browser</dt>
              <dd className="font-mono text-slate-200">Playwright · Chromium (isolated per task)</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Step budget</dt>
              <dd className="font-mono text-slate-200">{info ? `${info.limits.max_steps} steps` : "…"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Task time limit</dt>
              <dd className="font-mono text-slate-200">
                {info ? `${info.limits.max_task_minutes} min` : "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Domain policy</dt>
              <dd className="font-mono text-slate-200">explicit allowlist</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            V1 is a general-purpose browser agent within these boundaries — it is not claimed to work
            perfectly on every website. Sites may block automation, change layout, or require logins
            NEBULA will not perform.
          </p>
        </Panel>
      </section>
    </div>
  );
}
