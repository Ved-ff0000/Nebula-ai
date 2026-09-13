/**
 * /login — on-brand sign-in. Cinematic single-column form, no marketing
 * fluff, demo credential one click away.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, Sparkles, User as UserIcon } from "lucide-react";
import { api, setSession } from "@/lib/api";
import { NebulaInput } from "@/components/primitives/NebulaInput";
import { NebulaButton } from "@/components/primitives/NebulaButton";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password, name);
      setSession(res.access_token, res.user);
      router.push("/tasks");
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setEmail("demo@nebula.ai");
    setPassword("nebula-demo-2024");
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      {/* ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(33,150,243,0.10), transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <span
            className="grid size-7 place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--color-accent-400), var(--color-accent-700))",
            }}
          >
            <span className="size-2 rounded-full bg-white" />
          </span>
          <span className="mono text-[13px] tracking-[0.24em] text-strong">NEBULA</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-strong">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {mode === "login"
            ? "Resume your missions. The browser is yours."
            : "One AI. Every Website. Make it yours."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "register" && (
            <NebulaInput
              iconLeft={<UserIcon className="size-3.5" />}
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <NebulaInput
            type="email"
            iconLeft={<Mail className="size-3.5" />}
            placeholder="you@nebula.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <NebulaInput
            type="password"
            iconLeft={<Lock className="size-3.5" />}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div
              className="rounded-[var(--radius-md)] border px-3 py-2 text-[12.5px]"
              style={{
                borderColor: "rgba(239,77,107,0.30)",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}

          <NebulaButton type="submit" loading={busy} className="w-full justify-center">
            {mode === "login" ? "Sign in" : "Create account"}
          </NebulaButton>
        </form>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={useDemo}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-void-line)] bg-[var(--color-void-soft)] px-2.5 py-1.5 text-[11.5px] text-muted hover:text-strong"
          >
            <Sparkles className="size-3 text-[var(--color-accent-300)]" />
            Use demo account
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-[11.5px] text-faint hover:text-strong"
          >
            {mode === "login" ? "No account? Register" : "Have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
