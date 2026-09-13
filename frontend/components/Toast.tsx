"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "info" | "success" | "error" | "warning";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ push: (message: string, kind?: ToastKind) => void }>({
  push: () => {},
});

const KIND_CLASS: Record<ToastKind, string> = {
  info: "border-[rgba(33,150,243,0.35)] bg-[rgba(33,150,243,0.10)] text-[var(--color-accent-200)]",
  success: "border-[rgba(45,212,191,0.30)] bg-[var(--color-success-bg)]/10 text-[var(--color-success)]",
  error: "border-[rgba(239,77,107,0.30)] bg-[var(--color-danger-bg)]/10 text-[var(--color-danger)]",
  warning: "border-[rgba(245,185,79,0.30)] bg-[var(--color-warning-bg)]/10 text-[var(--color-warning)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(360px,90vw)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fade-up rounded-xl border px-4 py-3 text-sm shadow-panel backdrop-blur-xl ${KIND_CLASS[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
