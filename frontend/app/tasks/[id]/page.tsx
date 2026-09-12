"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTaskStream } from "@/hooks/useTaskStream";
import { BrowserPanel } from "@/components/BrowserPanel";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ApprovalCard } from "@/components/ApprovalCard";
import { ResultCard } from "@/components/ResultCard";
import { StateMessage } from "@/components/StateMessage";
import { Chip, Panel, ProgressBar, SectionTitle, StatusPill } from "@/components/ui";
import { IconPause, IconPlay, IconPlus, IconRefresh, IconStop } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { durationFrom, STATUS_LABEL, timeAgo } from "@/lib/format";

export default function TaskWorkspacePage() {
  const params = useParams<{ id: string }>();
  const taskId = params?.id;
  const router = useRouter();
  const toast = useToast();
  const { task, browser, connection, pendingApprovals, error, refresh } = useTaskStream(taskId);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"timeline" | "security" | "approvals" | "domains">("timeline");

  const securityEvents = useMemo(
    () => (task?.events || []).filter((e) => e.type === "security" || e.status === "blocked"),
    [task],
  );
  const approvals = task?.approvals || [];
  const isPaused = task ? ["WAITING_FOR_APPROVAL"].includes(task.status) : false;

  const act = useCallback(
    async (fn: () => Promise<unknown>, message: string) => {
      setBusy(true);
      try {
        await fn();
        toast.push(message, "success");
        await refresh();
      } catch (e) {
        toast.push(e instanceof Error ? e.message : "Action failed", "error");
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );

  if (!task && !error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="skeleton h-8 w-64" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-80" />
          <div className="skeleton h-80" />
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Panel className="p-6 text-center">
          <p className="text-sm text-rose-200">{error}</p>
          <Link href="/" className="btn-ghost mt-4">Back home</Link>
        </Panel>
      </div>
    );
  }
  if (!task) return null;

  const active = ["PLANNING", "RUNNING", "WAITING_FOR_APPROVAL", "VERIFYING"].includes(task.status);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      {/* ------------------------------------------------------------ top bar */}
      <Panel className="mb-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={task.status} />
              {(() => {
                const terminal = ["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"].includes(task.status);
                const label = connection === "live" ? "live" : terminal ? "ended" : connection === "polling" ? "polling" : "connecting";
                return (
                  <Chip tone={connection === "live" ? "good" : label === "ended" ? "idle" : "warn"}>
                    <span className={`h-1.5 w-1.5 rounded-full bg-current ${connection === "live" ? "animate-pulse" : ""}`} />
                    {label}
                  </Chip>
                );
              })()}
              <span className="font-mono text-[10px] text-slate-500">
                #{task.id.slice(0, 8)} · {timeAgo(task.updated_at)}
              </span>
            </div>
            <h1 className="mt-2 text-[15px] font-medium leading-snug text-slate-100">{task.goal}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!active && (task.status === "FAILED" || task.status === "CANCELLED" || task.status === "BLOCKED") && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => act(() => api.startTask(task.id), "Task restarted")}
              >
                <IconRefresh size={14} /> Retry task
              </button>
            )}
            {active && !isPaused && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => act(() => api.pauseTask(task.id), "Task paused")}
              >
                <IconPause size={14} /> Pause
              </button>
            )}
            {task.status === "RUNNING" && (
              <button
                className="btn-ghost hidden sm:inline-flex"
                disabled={busy}
                onClick={() => act(() => api.resumeTask(task.id), "Task resumed")}
              >
                <IconPlay size={13} /> Resume
              </button>
            )}
            {active && (
              <button
                className="btn-danger"
                disabled={busy}
                onClick={() => act(() => api.stopTask(task.id), "Stop requested — kill switch armed")}
              >
                <IconStop size={13} /> Stop
              </button>
            )}
            <Link href="/" className="btn-primary"><IconPlus size={15} /> New task</Link>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <SectionTitle right={<span className="text-[10px] text-slate-500">{STATUS_LABEL[task.status]}</span>}>
              Progress
            </SectionTitle>
            <ProgressBar value={task.current_step} max={task.max_steps} />
            <p className="mt-2 text-[11px] text-slate-400">
              {task.plan_summary || "Waiting for the plan…"}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 text-[11px]">
            <Chip>elapsed {durationFrom(task.started_at, task.completed_at)}</Chip>
            <Chip>retries {task.retry_count}</Chip>
            <Chip>{task.domains.length} origin{task.domains.length === 1 ? "" : "s"}</Chip>
            {approvals.some((a) => a.status === "APPROVED") && <Chip tone="good">approved once</Chip>}
            {approvals.some((a) => a.status === "REJECTED") && <Chip tone="bad">rejection recorded</Chip>}
          </div>
        </div>
      </Panel>

      {/* -------------------------------------------------- approval requests */}
      {pendingApprovals.map((a) => (
        <div key={a.id} className="mb-4">
          <ApprovalCard
            approval={a}
            busy={busy}
            onApprove={(reason) => act(() => api.approve(task.id, a.id, reason), "Approved once — executing this action only")}
            onReject={(reason) => act(() => api.reject(task.id, a.id, reason), "Rejected — the action will not run")}
            onStop={() => act(() => api.stopTask(task.id), "Task stopped")}
          />
        </div>
      ))}

      {/* ------------------------------------------------------- state banners */}
      <div className="mb-4 flex flex-col gap-3">
        <StateMessage task={task} />
        {task.status === "RUNNING" && isPaused && (
          <Panel className="border-amber-400/30 p-3 text-[13px] text-amber-100">
            Task paused. The browser is holding its session and will not act until you resume or stop.
          </Panel>
        )}
      </div>

      {/* ------------------------------------------------------- split screen */}
      <div className="grid gap-4 xl:grid-cols-2">
        <BrowserPanel taskId={task.id} status={task.status} initial={browser} />

        <div className="flex min-w-0 flex-col gap-4">
          {task.result && <ResultCard task={task} onNewTask={() => router.push("/")} />}

          <Panel className="flex min-h-[420px] flex-col p-4">
            <div className="mb-3 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              {([
                ["timeline", `Activity (${task.events.length})`],
                ["security", `Security (${securityEvents.length})`],
                ["approvals", `Approvals (${approvals.length})`],
                ["domains", `Domains (${task.domains.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                    tab === key ? "bg-nebula-500/25 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                  aria-pressed={tab === key}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="scroll-area max-h-[62vh] flex-1 pr-1">
              {tab === "timeline" && <ActivityTimeline events={task.events} />}

              {tab === "security" && (
                <div className="flex flex-col gap-3">
                  {securityEvents.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
                      No security events — every action so far was LOW/MEDIUM risk on allowed domains.
                    </p>
                  ) : (
                    <ActivityTimeline events={securityEvents} />
                  )}
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-slate-400">
                    Policy decisions are enforced server-side before execution. Page content is treated as
                    untrusted data: instructions found inside pages can never change NEBULA&apos;s policy,
                    and secret material is never entered or extracted.
                  </div>
                </div>
              )}

              {tab === "approvals" && (
                <div className="flex flex-col gap-3">
                  {approvals.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
                      No approval requests yet. Consequential actions pause here before they run.
                    </p>
                  ) : (
                    approvals.map((a) => (
                      <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={a.status === "APPROVED" ? "good" : a.status === "REJECTED" ? "bad" : "warn"}>
                            {a.status}
                          </Chip>
                          <Chip tone={a.risk_level === "HIGH" ? "warn" : "idle"}>{a.risk_level} risk</Chip>
                          <span className="ml-auto font-mono text-[10px] text-slate-500">
                            {timeAgo(a.requested_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] text-slate-200">{a.description}</p>
                        <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{a.target_origin}</p>
                        {a.payload_summary && (
                          <p className="mt-1 text-[11px] text-slate-400">Action: {a.payload_summary}</p>
                        )}
                        {a.resolved_at && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Resolved {timeAgo(a.resolved_at)} · single-action only
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "domains" && (
                <div className="flex flex-col gap-2">
                  {task.domains.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
                      No origins visited yet.
                    </p>
                  ) : (
                    task.domains.map((d) => (
                      <div key={d} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <span className="truncate font-mono text-[11px] text-slate-200">{d}</span>
                        <Chip tone="good">allowlisted</Chip>
                      </div>
                    ))
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    Every origin transition is logged. Unexpected cross-origin navigations require explicit
                    task permission.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
