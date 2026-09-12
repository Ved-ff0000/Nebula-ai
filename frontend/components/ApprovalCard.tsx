"use client";

import { useState } from "react";
import type { Approval } from "@/lib/types";
import { IconCheck, IconFlag, IconStop, IconWarn } from "./icons";

/**
 * High-visibility approval gate. Shown immediately BEFORE a consequential
 * action. The browser stays paused until the user decides; approval is
 * single-action and cannot be reused for later actions.
 */
export function ApprovalCard({
  approval, onApprove, onReject, onStop, busy,
}: {
  approval: Approval;
  onApprove: (reason: string) => void;
  onReject: (reason: string) => void;
  onStop: () => void;
  busy?: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <section
      role="alertdialog"
      aria-labelledby={`approval-${approval.id}`}
      className="animate-fade-up rounded-2xl border border-amber-400/40 bg-amber-500/[0.07] p-4 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-200" aria-hidden>
          <IconFlag size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`approval-${approval.id}`} className="text-sm font-semibold text-amber-100">
            Approval required — {approval.risk_level} risk action
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-amber-50/90">{approval.description}</p>

          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Target origin</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-200">{approval.target_origin}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Action</dt>
              <dd className="mt-0.5 break-words text-[11px] text-slate-200">
                {approval.payload_summary || approval.action_id}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[11px] text-amber-100/70">
            The browser is paused. Approval applies to this single action only — it cannot authorise
            future or unrelated actions. Nothing has been submitted yet.
          </p>

          <label className="mt-3 block text-[11px] text-slate-400">
            Optional note for the audit log
            <input
              className="input mt-1 py-2 text-xs"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. reviewed the form contents"
              maxLength={300}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-success" disabled={busy} onClick={() => onApprove(reason)}>
              <IconCheck size={15} /> Approve once
            </button>
            <button className="btn-danger" disabled={busy} onClick={() => onReject(reason)}>
              <IconWarn size={15} /> Reject
            </button>
            <button className="btn-ghost" disabled={busy} onClick={onStop}>
              <IconStop size={14} /> Stop task
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
