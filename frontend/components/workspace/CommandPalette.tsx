"use client";
/**
 * CommandPalette — ⌘K. Restrained, single column, keyboard-first.
 * Filters as you type; Enter to run; Escape to close.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Pause, Play, Hand, Settings, ListChecks } from "lucide-react";

type Action = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onNewTask: () => void;
  onPause: () => void;
  onResume: () => void;
  onTakeControl: () => void;
}

export function CommandPalette({
  open, onClose, onNewTask, onPause, onResume, onTakeControl,
}: Props) {
  const reduced = useReducedMotion();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  const actions: Action[] = useMemo(() => [
    { id: "new",     label: "New Task",         hint: "⌘N", icon: <Plus className="size-3.5" />, run: () => { onClose(); onNewTask(); } },
    { id: "pause",   label: "Pause Agent",      hint: "P",  icon: <Pause className="size-3.5" />, run: () => { onClose(); onPause(); } },
    { id: "resume",  label: "Resume Agent",     hint: "R",  icon: <Play className="size-3.5" />, run: () => { onClose(); onResume(); } },
    { id: "control", label: "Take Control",     hint: "T",  icon: <Hand className="size-3.5" />, run: () => { onClose(); onTakeControl(); } },
    { id: "list",    label: "Search Tasks",     hint: "G T", icon: <ListChecks className="size-3.5" />, run: () => { onClose(); } },
    { id: "set",     label: "Settings",         hint: "G S", icon: <Settings className="size-3.5" />, run: () => { onClose(); } },
  ], [onClose, onNewTask, onPause, onResume, onTakeControl]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return actions;
    return actions.filter(a => a.label.toLowerCase().includes(k));
  }, [actions, q]);

  useEffect(() => { setSelected(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        const a = filtered[selected];
        if (a) a.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selected, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ background: "rgba(5,6,15,0.70)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
          role="dialog"
          aria-label="Command palette"
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-void-line)] bg-[var(--color-void-panel)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-void-line)] px-3 py-2.5">
              <Search className="size-4 text-faint" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a command…"
                className="flex-1 bg-transparent text-[14px] text-strong placeholder:text-faint focus:outline-none"
              />
              <span className="mono text-[10px] text-faint">ESC</span>
            </div>
            <ul className="max-h-72 overflow-y-auto p-1">
              {filtered.map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={a.run}
                    onMouseEnter={() => setSelected(i)}
                    className={
                      "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] " +
                      (i === selected
                        ? "bg-[var(--color-void-elevated)] text-strong"
                        : "text-muted hover:bg-[var(--color-void-soft)] hover:text-strong")
                    }
                  >
                    <span className="grid size-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-void-soft)] text-[var(--color-accent-300)]">
                      {a.icon}
                    </span>
                    <span className="flex-1 text-left">{a.label}</span>
                    <span className="mono text-[10px] text-faint">{a.hint}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] text-faint">
                  No matches.
                </li>
              )}
            </ul>
            <div className="border-t border-[var(--color-void-line)] px-3 py-2 text-[10px] text-faint">
              <span className="mono">↑↓</span> navigate · <span className="mono">↵</span> run · <span className="mono">esc</span> close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
