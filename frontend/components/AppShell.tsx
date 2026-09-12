"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearSession, getCachedUser, getToken } from "@/lib/api";
import { NebulaLogo, NebulaMark } from "./NebulaLogo";
import { useTheme } from "@/hooks/useTheme";
import { Chip } from "./ui";
import { IconActivity, IconHome, IconList, IconPlus, IconSettings } from "./icons";
import type { Task, User } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/format";

const NAV = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/tasks", label: "Tasks", icon: IconList },
  { href: "/activity", label: "Activity", icon: IconActivity },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recent, setRecent] = useState<Task[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authed, setAuthed] = useState(false);

  const isAuthPage = pathname?.startsWith("/login");

  useEffect(() => {
    const token = getToken();
    setAuthed(Boolean(token));
    if (!token || isAuthPage) return;
    setUser(getCachedUser());
    api.me().then(setUser).catch(() => {});
    api.listTasks().then((tasks) => setRecent(tasks.slice(0, 6))).catch(() => {});
  }, [pathname, isAuthPage]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Auth guard: unauthenticated users are redirected to the sign-in page.
  useEffect(() => {
    if (!isAuthPage && !getToken()) router.replace("/login");
  }, [isAuthPage, router, pathname]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  const sidebar = (
    <aside
      className={`flex h-full flex-col gap-4 border-r border-white/10 bg-void-soft/70 p-3 backdrop-blur-xl transition-[width] duration-300 ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        {collapsed ? <NebulaMark size={26} /> : <NebulaLogo />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 lg:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <Link href="/" className="btn-primary w-full">
        <IconPlus size={16} />
        {!collapsed && "New task"}
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "border border-nebula-400/30 bg-nebula-500/15 text-white"
                  : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
              }`}
              title={item.label}
            >
              <span aria-hidden><item.icon size={17} /></span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="min-h-0 flex-1">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">Recent</p>
          <div className="scroll-area flex max-h-[38vh] flex-col gap-1 pr-1">
            {recent.length === 0 && (
              <p className="px-3 text-xs text-slate-500">No tasks yet — give the web a goal.</p>
            )}
            {recent.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className={`rounded-xl px-3 py-2 text-xs transition hover:bg-white/[0.05] ${
                  pathname === `/tasks/${t.id}` ? "bg-white/[0.06] text-slate-100" : "text-slate-400"
                }`}
              >
                <span className="line-clamp-2">{t.goal}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="h-1 w-1 rounded-full bg-nebula-300/70" />
                  {STATUS_LABEL[t.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-nebula-500 to-plasma-500 text-xs font-semibold text-white">
            {(user?.display_name || user?.email || "N").slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-xs text-slate-200">
                {user?.display_name || user?.email || "Operator"}
              </span>
              <span className="block truncate text-[10px] text-slate-500">
                {user?.email || "not signed in"}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="btn-ghost flex-1 px-2 py-1.5 text-xs" aria-label="Toggle theme">
            {theme === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
          {authed && !collapsed && (
            <button
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
              className="btn-ghost px-2 py-1.5 text-xs"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-fade-up">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-void/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button onClick={() => setDrawerOpen(true)} className="btn-ghost px-3 py-1.5" aria-label="Open navigation">
            ☰
          </button>
          <NebulaLogo compact />
          <div className="ml-auto">
            <Chip tone="active">agent ready</Chip>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
