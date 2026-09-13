"use client";
/**
 * Sidebar — the left rail. Minimal, restrained, with keyboard shortcuts
 * on hover. Width is fixed (240px on desktop) so the center has room.
 *
 * Shows: NEBULA logo, primary actions (New Task, ⌘K), task list, settings.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Settings, Activity, Sparkles, History } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
  onNewTask: () => void;
  onOpenPalette: () => void;
}

const NAV = [
  { href: "/tasks",     icon: Sparkles, label: "Tasks",       hint: "G T" },
  { href: "/activity",  icon: Activity, label: "Activity",    hint: "G A" },
  { href: "/settings",  icon: Settings, label: "Settings",    hint: "G S" },
] as const;

export function Sidebar({ tasks, onNewTask, onOpenPalette }: Props) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/tasks/") ? pathname.split("/")[2] : null;

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--color-void-line)] bg-[var(--color-void-soft)] lg:flex">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-void-line)] px-4">
        <span
          className="grid size-6 place-items-center rounded-full"
          style={{
            background:
              "radial-gradient(circle, var(--color-accent-400), var(--color-accent-700))",
          }}
        >
          <span className="size-1.5 rounded-full bg-white" />
        </span>
        <span className="mono text-[12px] tracking-[0.24em] text-strong">
          NEBULA
        </span>
      </div>

      {/* Primary actions */}
      <div className="space-y-1 px-2 py-3">
        <SidebarButton onClick={onNewTask} icon={<Plus className="size-3.5" />} hint="⌘N">
          New Task
        </SidebarButton>
        <SidebarButton onClick={onOpenPalette} icon={<Search className="size-3.5" />} hint="⌘K">
          Search
        </SidebarButton>
      </div>

      {/* Nav */}
      <div className="px-2">
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={
                "flex h-8 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[12.5px] " +
                (active
                  ? "bg-[var(--color-void-elevated)] text-strong"
                  : "text-muted hover:text-strong hover:bg-[var(--color-void-elevated)]")
              }
            >
              <Icon className="size-3.5" />
              <span>{n.label}</span>
              {n.hint && (
                <span className="ml-auto mono text-[10px] text-faint">{n.hint}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Recent tasks */}
      <div className="mt-6 flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-2.5 pb-1.5">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Recent
          </span>
          <History className="size-3 text-faint" />
        </div>
        <ul className="space-y-0.5">
          {tasks.slice(0, 12).map((t) => {
            const active = activeId === t.id;
            return (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className={
                    "group flex items-start gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-[12.5px] " +
                    (active
                      ? "bg-[var(--color-void-elevated)]"
                      : "hover:bg-[var(--color-void-elevated)]")
                  }
                >
                  <StatusDot status={t.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-strong">
                      {t.goal.slice(0, 60)}
                    </div>
                    <div className="mono mt-0.5 text-[10px] text-faint">
                      {t.status.toLowerCase()} · {shortAgo(t.created_at)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {tasks.length === 0 && (
            <li className="px-2.5 py-3 text-[12px] text-faint">
              No tasks yet. Press ⌘N to start one.
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

function SidebarButton({
  onClick, icon, hint, children,
}: { onClick: () => void; icon: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-void-elevated)] px-2.5 text-[12.5px] text-strong hover:bg-[var(--color-void-panel)]"
    >
      {icon}
      <span>{children}</span>
      {hint && <span className="ml-auto mono text-[10px] text-faint">{hint}</span>}
    </motion.button>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "COMPLETED" ? "var(--color-success)" :
    status === "FAILED" ? "var(--color-danger)" :
    status === "CANCELLED" ? "var(--color-ink-faint)" :
    status === "WAITING_FOR_APPROVAL" ? "var(--color-warning)" :
    "var(--color-accent-300)";
  return (
    <span
      className="mt-1.5 size-1.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

function shortAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
