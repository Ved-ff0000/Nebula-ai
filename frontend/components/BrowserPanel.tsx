"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BrowserState, TaskStatus } from "@/lib/types";
import { Chip, SectionTitle, Spinner } from "./ui";
import { IconRefresh, IconWarn } from "./icons";
import { clockTime, originOf } from "@/lib/format";

/**
 * Live browser preview: sandboxed Chromium session for this task.
 * Shows current URL/origin, page title, load state, and a refreshable
 * screenshot. The agent's browser runs server-side and is never the user's
 * own browser session.
 */
export function BrowserPanel({ taskId, status, initial }:
  { taskId: string; status: TaskStatus; initial: BrowserState | null }) {
  const [state, setState] = useState<BrowserState | null>(initial);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => setState(initial), [initial]);

  const refresh = async () => {
    setLoading(true);
    try {
      setState(await api.browser(taskId));
      setNonce((n) => n + 1);
    } catch {
      setState((s) => s ?? { available: false } as BrowserState);
    } finally {
      setLoading(false);
    }
  };

  // auto-refresh the frame while the agent is working
  useEffect(() => {
    if (!["RUNNING", "PLANNING", "VERIFYING", "WAITING_FOR_APPROVAL"].includes(status)) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, taskId]);

  const origin = state?.url ? originOf(state.url) : state?.origin || "";
  const browserOffline = !state?.available;
  const hasFrame = Boolean(state?.screenshot);

  return (
    <section className="panel flex min-h-[420px] flex-col overflow-hidden" aria-label="Browser preview">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5">
          <p className="truncate font-mono text-[11px] text-slate-300" title={state?.url || ""}>
            {state?.url || "about:blank"}
          </p>
        </div>
        <Chip tone={browserOffline ? "idle" : state?.status === "loading" ? "warn" : "good"}>
          {state?.status === "closed" ? "session closed" : browserOffline ? "no session" : state?.status || "idle"}
        </Chip>
        <button onClick={refresh} className="btn-ghost px-2.5 py-1.5 text-xs" disabled={loading}>
          <span className={loading ? "animate-spin" : ""}><IconRefresh size={14} /></span>
          refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[11px] text-slate-400">
        <Chip tone="active">{origin || "origin unknown"}</Chip>
        <span className="truncate">Isolated Chromium context · task-scoped · downloads blocked</span>
        {state?.updated_at && (
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            frame {clockTime(new Date(state.updated_at * 1000).toISOString())}
          </span>
        )}
      </div>

      <div className="relative flex flex-1 items-start justify-center p-3">
        {state?.screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={nonce}
            src={state.screenshot}
            alt="Live screenshot of the agent-controlled browser page"
            className="max-h-[62vh] w-full animate-fade-up rounded-xl border border-white/10 object-contain shadow-panel"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            {browserOffline && !hasFrame ? (
              <>
                <span className="text-slate-500" aria-hidden><IconWarn size={30} /></span>
                <p className="text-sm text-slate-300">No live browser session</p>
                <p className="max-w-sm text-xs text-slate-500">
                  A sandboxed browser session is created when the task starts and destroyed when it ends.
                  Start the task to see the live frame here. If a task fails with “Browser unavailable”,
                  that page shows the exact command to fix this machine.
                </p>
              </>
            ) : browserOffline && hasFrame ? (
              <div className="w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state?.screenshot ?? ""}
                  alt="Final frame captured before the sandboxed browser session closed"
                  className="max-h-[62vh] w-full rounded-xl border border-white/10 object-contain opacity-80 shadow-panel"
                />
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Session closed — showing the final frame the agent saw. Screenshots are never written to disk.
                </p>
              </div>
            ) : (
              <Spinner label="Waiting for the first frame…" />
            )}
          </div>
        )}
        {state?.status === "loading" && !browserOffline && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="h-full w-1/3 animate-sweep bg-gradient-to-r from-nebula-500 to-plasma-400" />
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <SectionTitle>Page</SectionTitle>
        <p className="truncate text-sm text-slate-300" title={state?.title || ""}>
          {state?.title || "—"}
        </p>
      </div>
    </section>
  );
}
