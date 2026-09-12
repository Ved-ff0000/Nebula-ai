"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession } from "@/lib/api";
import { NebulaLogo, NebulaMark } from "@/components/NebulaLogo";
import { Chip } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password, name || "Operator");
      setSession(res.access_token, res.user);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setMode("login");
    setEmail("demo@nebula.ai");
    setPassword("nebula-demo-2024");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <NebulaMark size={54} />
          <div className="mt-3">
            <NebulaLogo compact />
          </div>
          <p className="mt-3 text-sm text-slate-400">
            An AI operating system for the web. Sign in to run and audit agent tasks.
          </p>
        </div>

        <form onSubmit={submit} className="panel glow-ring p-5">
          <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  mode === m ? "bg-nebula-500/25 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
                aria-pressed={mode === m}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <label className="mb-3 block text-xs text-slate-400">
              Display name
              <input className="input mt-1 py-2" value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="Operator" autoComplete="name" />
            </label>
          )}

          <label className="mb-3 block text-xs text-slate-400">
            Email
            <input
              className="input mt-1 py-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>

          <label className="mb-4 block text-xs text-slate-400">
            Password
            <input
              className="input mt-1 py-2"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "at least 8 characters" : "••••••••"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          {error && (
            <p role="alert" className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] text-slate-400">
              Local demo account (created on first run by the backend):
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="active">demo@nebula.ai</Chip>
              <Chip>nebula-demo-2024</Chip>
              <button type="button" onClick={fillDemo} className="btn-ghost ml-auto px-2.5 py-1 text-[11px]">
                use demo
              </button>
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Tokens are stored locally in your browser. NEBULA never stores credentials, form contents or
          payment data on the server.
        </p>
      </div>
    </div>
  );
}
