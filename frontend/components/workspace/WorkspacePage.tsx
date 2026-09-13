"use client";
/**
 * WorkspacePage — the three-zone screen. Composed from:
 *  - Sidebar (left)
 *  - Conversation + Live Browser View (center)
 *  - Mission Timeline + Agent Activity (right)
 *
 * Wires the real backend via lib/api.ts. Subscribes to WebSocket updates
 * when a task is active. Uses the deterministic scripted mission when
 * the user opens it from the landing page (no task selected yet).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Pause, Play, Hand, Settings2, Activity as ActivityIcon, Eye, EyeOff } from "lucide-react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { MissionTimeline } from "@/components/workspace/MissionTimeline";
import { AgentActivity, type ActivityItem } from "@/components/workspace/AgentActivity";
import { BrowserViewport } from "@/components/workspace/BrowserViewport";
import { ApprovalPanel } from "@/components/workspace/ApprovalPanel";
import { TakeoverPanel } from "@/components/workspace/TakeoverPanel";
import { TaskComposer } from "@/components/workspace/TaskComposer";
import { Panel, PanelHeader, PanelBody } from "@/components/primitives/Panel";
import { NebulaButton } from "@/components/primitives/NebulaButton";
import { LiveMission } from "@/components/marketing/LiveMission";
import * as apiModule from "@/lib/api";
import type { TaskDetail, Approval, Task, TaskStatus, TaskEvent } from "@/lib/types";

const api = apiModule.api;
const rememberApprovalContext = apiModule.rememberApprovalContext;

interface Props {
  /** Optional task id — when present, drives the workspace from real backend state. */
  taskId?: string | null;
  onTaskCreated?: (id: string) => void;
}

export function WorkspacePage({ taskId = null, onTaskCreated }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiView, setAiView] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(api.listTasksCached());
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(!taskId);
  const wsRef = useRef<WebSocket | null>(null);

  // Load task list once + poll every 8s while no task is selected.
  useEffect(() => {
    let mounted = true;
    api.listTasks()
      .then((list) => { if (!mounted) return; setTasks(list); api.cacheTasks(list); })
      .catch(() => {});
    const t = setInterval(() => {
      api.listTasks().then((list) => { if (!mounted) return; setTasks(list); api.cacheTasks(list); }).catch(() => {});
    }, 8000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Load selected task + events + open WS.
  useEffect(() => {
    if (!taskId) { setDetail(null); setEvents([]); return; }
    let mounted = true;
    setComposerOpen(false);
    api.getTask(taskId).then((t) => { if (!mounted) return; setDetail(t); rememberApprovalContext(t); }).catch(() => {});
    api.getTaskEvents(taskId).then((evs) => mounted && setEvents(evs)).catch(() => {});

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/tasks/${taskId}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === "task_update" || evt.type === "task") {
          api.getTask(taskId).then((t) => { if (!mounted) return; setDetail(t); rememberApprovalContext(t); });
          api.getTaskEvents(taskId).then((evs) => mounted && setEvents(evs));
        } else {
          setEvents((prev) => [...prev, evt].slice(-300));
        }
      } catch {}
    };
    return () => { mounted = false; ws.close(); };
  }, [taskId]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (isMeta && e.key.toLowerCase() === "n") { e.preventDefault(); setComposerOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activity: ActivityItem[] = useMemo(
    () => events.map((e) => ({
      id: e.id,
      type: (e.type || "status") as ActivityItem["type"],
      status: (e.status === "failed" ? "failed" :
               e.status === "warning" ? "warning" :
               e.status === "blocked" ? "failed" : "ok") as ActivityItem["status"],
      summary: e.summary || "",
      origin: e.origin ?? null,
      ts: e.timestamp,
    })),
    [events]
  );

  const pendingApproval: Approval | null = useMemo(
    () => (detail?.approvals ?? []).find((a) => a.status === "PENDING") ?? null,
    [detail]
  );

  async function handleSubmit(goal: string) {
    setBusy(true);
    try {
      const task = await api.createTask({ goal, domain: "demo-site" });
      const started = await api.startTask(task.id);
      setDetail(started as TaskDetail);
      setComposerOpen(false);
      onTaskCreated?.(task.id);
    } catch (e: any) {
      alert(e?.message ?? "Could not start task");
    } finally { setBusy(false); }
  }

  async function handleApprove(a: Approval) {
    setBusy(true);
    try { await api.approveApproval(a.id); }
    finally { setBusy(false); }
  }
  async function handleReject(a: Approval) {
    setBusy(true);
    try { await api.rejectApproval(a.id); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-void)] text-[var(--color-ink)]">
      <Sidebar
        tasks={tasks as any}
        onNewTask={() => setComposerOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* ============================== CENTER ============================== */}
      <main className="flex-1 overflow-y-auto">
        {/* header */}
        <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[var(--color-void-line)] bg-[var(--color-void-soft)]/80 px-4 backdrop-blur">
          <div className="mono text-[12px] tracking-[0.18em] text-strong">NEBULA</div>
          <span className="text-faint">·</span>
          <span className="text-[12.5px] text-muted">
            {taskId ? (detail?.goal?.slice(0, 64) ?? "Mission") : "Mission Control"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setAiView((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-2.5 text-[12px] text-muted hover:text-strong"
              title={aiView ? "Hide AI Vision" : "Show AI Vision"}
            >
              {aiView ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              AI View
            </button>
            {detail && (
              <PauseResumeControl
                taskId={detail.id}
                status={detail.status}
                onChange={(s) => setDetail((d) => d && ({ ...d, status: s }))}
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
          {/* CENTER COLUMN */}
          <div className="space-y-4">
            {composerOpen && !taskId && (
              <TaskComposer onSubmit={handleSubmit} defaultDomain="demo-site" />
            )}

            {taskId && detail && (
              <Panel>
                <PanelHeader>
                  <div className="flex items-center gap-2">
                    <span
                      className="mono text-[10px] uppercase tracking-[0.18em] text-faint"
                    >
                      Mission
                    </span>
                    <StatusChip status={detail.status} />
                  </div>
                  <span className="mono text-[10px] text-faint">
                    steps {detail.current_step}/{detail.max_steps}
                  </span>
                </PanelHeader>
                <PanelBody>
                  <div className="text-[13.5px] leading-relaxed text-strong">
                    {detail.goal}
                  </div>
                  {detail.plan_summary && (
                    <div className="mt-3 text-[12.5px] leading-relaxed text-muted">
                      {detail.plan_summary}
                    </div>
                  )}
                </PanelBody>
              </Panel>
            )}

            {/* Live browser */}
            <BrowserViewport
              url={detail?.domains?.[0] ?? "demo-site"}
              title={detail ? "Active page" : "Idle"}
              status={
                detail?.status === "RUNNING" ? "reading" :
                detail?.status === "WAITING_FOR_APPROVAL" ? "interacting" :
                "idle"
              }
              targetLabel={
                activity.find((a) => a.status === "running")?.summary ?? null
              }
            />

            {/* AI Vision overlay (when toggled) */}
            <AnimatePresence>
              {aiView && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Panel>
                    <PanelHeader>
                      <div className="flex items-center gap-2">
                        <Eye className="size-3.5 text-[var(--color-accent-300)]" />
                        <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
                          Page Understanding
                        </span>
                      </div>
                    </PanelHeader>
                    <PanelBody className="grid gap-3 sm:grid-cols-2">
                      <VisionItem label="Search field"     status="ok" />
                      <VisionItem label="Price filter"     status="ok" />
                      <VisionItem label="Product cards"    status="ok" detail="24 detected" />
                      <VisionItem label="Checkout button"  status="ok" />
                    </PanelBody>
                  </Panel>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Approval gate */}
            {pendingApproval && (
              <ApprovalPanel
                approval={pendingApproval}
                busy={busy}
                onApprove={() => handleApprove(pendingApproval)}
                onReject={() => handleReject(pendingApproval)}
              />
            )}

            {/* Takeover affordance (demo) */}
            <TakeoverPanel mode="ask" />

            {/* Conversation */}
            {taskId && detail && (
              <Panel>
                <PanelHeader>
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    Conversation
                  </span>
                  <span className="mono text-[10px] text-faint">{events.length} events</span>
                </PanelHeader>
                <PanelBody className="space-y-3">
                  <UserBubble text={detail.goal} />
                  {detail.result && (
                    <NebulaBubble text={detail.result.summary || "Task completed."} />
                  )}
                  {!detail.result && detail.status !== "COMPLETED" && (
                    <NebulaBubble text="Working on it. Watch the live browser and activity stream on the right for real-time progress." muted />
                  )}
                </PanelBody>
              </Panel>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <aside className="space-y-4">
            <Panel>
              <PanelHeader>
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Mission Timeline
                </span>
              </PanelHeader>
              <PanelBody>
                {detail ? (
                  <MissionTimeline status={detail.status} currentStep={detail.current_step} />
                ) : (
                  <div className="px-2 py-6 text-center text-[12px] text-faint">
                    Select or start a mission to see its timeline.
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  Activity
                </span>
                <span className="mono text-[10px] text-faint">{events.length}</span>
              </PanelHeader>
              <PanelBody>
                <AgentActivity items={activity} />
              </PanelBody>
            </Panel>

            {!taskId && (
              <Panel>
                <PanelHeader>
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    Demo
                  </span>
                </PanelHeader>
                <PanelBody>
                  <LiveMission />
                </PanelBody>
              </Panel>
            )}
          </aside>
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewTask={() => setComposerOpen(true)}
        onPause={async () => { if (taskId) await api.pauseTask(taskId); }}
        onResume={async () => { if (taskId) await api.resumeTask(taskId); }}
        onTakeControl={() => { /* surfaces TakeoverPanel state */ }}
      />
    </div>
  );
}

function PauseResumeControl({
  taskId, status, onChange,
}: { taskId: string; status: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<TaskDetail>) {
    setBusy(true); try { const t = await fn(); onChange(t.status); }
    catch {} finally { setBusy(false); }
  }
  if (status === "CANCELLED" || status === "FAILED" || status === "COMPLETED") {
    return null;
  }
  return (
    <NebulaButton size="sm" variant="secondary" loading={busy}
      onClick={() => run(() => api.pauseTask(taskId))}
    ><Pause className="size-3" /> Pause</NebulaButton>
  );
}

function StatusChip({ status }: { status: TaskStatus }) {
  const tone =
    status === "COMPLETED" ? "success" :
    status === "FAILED" ? "danger" :
    status === "WAITING_FOR_APPROVAL" ? "warning" :
    status === "RUNNING" || status === "PLANNING" || status === "VERIFYING" ? "active" :
    "neutral";
  const label = status.toLowerCase().replace(/_/g, " ");
  return <span className={`chip-${tone === "active" ? "active" : ""}`} style={{
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
    padding: "0.18rem 0.55rem", borderRadius: 999, fontSize: 11, lineHeight: 1,
    border: tone === "success" ? "1px solid rgba(45,212,191,0.30)" :
            tone === "danger" ? "1px solid rgba(239,77,107,0.30)" :
            tone === "warning" ? "1px solid rgba(245,185,79,0.30)" :
            tone === "active" ? "1px solid rgba(33,150,243,0.35)" :
            "1px solid var(--color-void-line)",
    background: tone === "success" ? "var(--color-success-bg)" :
                tone === "danger" ? "var(--color-danger-bg)" :
                tone === "warning" ? "var(--color-warning-bg)" :
                tone === "active" ? "rgba(33,150,243,0.10)" :
                "var(--color-void-soft)",
    color: tone === "success" ? "var(--color-success)" :
           tone === "danger" ? "var(--color-danger)" :
           tone === "warning" ? "var(--color-warning)" :
           tone === "active" ? "var(--color-accent-200)" :
           "var(--color-ink-muted)",
  }}>{label}</span>;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[80%] rounded-[var(--radius-lg)] bg-[var(--color-void-elevated)] px-3 py-2 text-[13px] text-strong"
      >
        {text}
      </div>
    </div>
  );
}
function NebulaBubble({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[80%] rounded-[var(--radius-lg)] bg-[var(--color-void-soft)] px-3 py-2 text-[13px]"
        style={{ color: muted ? "var(--color-ink-muted)" : "var(--color-ink-strong)" }}
      >
        {text}
      </div>
    </div>
  );
}

function VisionItem({
  label, status, detail,
}: { label: string; status: "ok" | "warn" | "miss"; detail?: string }) {
  const color =
    status === "ok"   ? "var(--color-success)" :
    status === "warn" ? "var(--color-warning)" :
                        "var(--color-danger)";
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-3 py-2 text-[12.5px]">
      <span className="text-strong">{label}</span>
      <span className="flex items-center gap-2 mono text-[10px] text-faint">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        {detail ?? "recognized"}
      </span>
    </div>
  );
}
