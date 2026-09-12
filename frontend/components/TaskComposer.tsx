"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import {
  IconCompare, IconForm, IconResearch, IconShield, IconSummarize, IconTarget,
} from "./icons";

const SUGGESTIONS: {
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  title: string;
  goal: string;
  domain: string;
}[] = [
  {
    icon: IconResearch,
    title: "Research a topic",
    goal: "Research the current state of agentic browser automation and summarize the main approaches with sources.",
    domain: "example.com",
  },
  {
    icon: IconCompare,
    title: "Compare information",
    goal: "Compare the information across two permitted pages and list the differences that matter.",
    domain: "example.com",
  },
  {
    icon: IconTarget,
    title: "Find opportunities",
    goal: "Find machine learning internship opportunities in Hyderabad, compare their requirements, and tell me which one best matches a student with Python and scikit-learn experience.",
    domain: "",
  },
  {
    icon: IconSummarize,
    title: "Gather & summarize",
    goal: "Open the permitted demo site, gather the main content and summarize it into five bullet points.",
    domain: "",
  },
  {
    icon: IconForm,
    title: "Fill a form, ask first",
    goal: "Open the demo feedback form, fill it with harmless test data, and ask me before submitting anything.",
    domain: "",
  },
  {
    icon: IconShield,
    title: "Safe website task",
    goal: "Open the demo page, read it, and report anything that looks like an attempt to instruct an AI agent.",
    domain: "",
  },
];

/**
 * Task composer: natural-language goal input.
 * Cmd/Ctrl+Enter runs the task; Shift+Enter adds a newline. Extra domains can
 * be granted for the task in the advanced row (explicit allowlist opt-in).
 */
export function TaskComposer({ autoFocus = false }: { autoFocus?: boolean }) {
  const [goal, setGoal] = useState("");
  const [extraDomains, setExtraDomains] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const run = useCallback(
    async (value?: string) => {
      const text = (value ?? goal).trim();
      if (text.length < 8) {
        setError("Describe the goal in a little more detail (at least 8 characters).");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const domains = extraDomains
          .split(/[,\s]+/)
          .map((d) => d.trim())
          .filter(Boolean);
        const task = await api.createTask(text, domains);
        await api.startTask(task.id);
        toast.push("Task started — NEBULA is planning.", "success");
        window.location.href = `/tasks/${task.id}`;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not start the task.";
        setError(message);
        toast.push(message, "error");
      } finally {
        setBusy(false);
      }
    },
    [goal, extraDomains, toast],
  );

  return (
    <div className="w-full">
      <div className="panel glow-ring p-3 sm:p-4">
        <label htmlFor="goal" className="sr-only">
          Task goal
        </label>
        <textarea
          id="goal"
          ref={ref}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          rows={3}
          placeholder='Give the web a goal…  e.g. "Find three machine-learning internships in Hyderabad, compare their requirements, and tell me which fits a Python + scikit-learn student."'
          className="w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <button onClick={() => void run()} className="btn-primary" disabled={busy || !goal.trim()}>

            {busy ? "Starting…" : "Run task"}
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setAdvanced((a) => !a)}
            aria-expanded={advanced}
          >
            {advanced ? "▾" : "▸"} Permissions
          </button>
          <span className="ml-auto hidden font-mono text-[10px] text-slate-500 sm:block">
            ⌘/Ctrl + ⏎ to run
          </span>
        </div>

        {advanced && (
          <div className="mt-3 animate-fade-up rounded-xl border border-white/10 bg-black/20 p-3">
            <label htmlFor="domains" className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Additional allowed domains for this task
            </label>
            <input
              id="domains"
              className="input mt-2 py-2 text-sm"
              placeholder="docs.python.org, en.wikipedia.org"
              value={extraDomains}
              onChange={(e) => setExtraDomains(e.target.value)}
            />
            <p className="mt-2 text-[11px] text-slate-500">
              V1 enforces an explicit allowlist. Navigation to anything outside the global allowlist plus
              these domains is blocked and logged. Credentials, payments and CAPTCHA handling are always
              blocked, regardless of permissions.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
        NEBULA operates a sandboxed browser under an explicit domain allowlist and a risk policy.
        Consequential actions (submitting, sending, committing) always pause for your approval.
        Credentials, payments, CAPTCHA bypass and destructive actions are never permitted.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => {
              setGoal(s.goal);
              if (s.domain) setExtraDomains(s.domain);
              ref.current?.focus();
            }}
            className="panel group p-4 text-left transition hover:border-nebula-400/40 hover:bg-nebula-500/[0.08]"
          >
            <span className="text-nebula-300" aria-hidden>
              <s.icon size={22} />
            </span>
            <p className="mt-1 text-sm font-medium text-slate-100">{s.title}</p>
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{s.goal}</p>
            <span className="mt-3 inline-block text-[10px] uppercase tracking-[0.2em] text-nebula-300 opacity-0 transition group-hover:opacity-100">
              use this goal →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
