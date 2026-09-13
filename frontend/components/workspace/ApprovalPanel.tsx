"use client";
/**
 * ApprovalPanel — the WAITING_FOR_APPROVAL state. Single-action human
 * approval gate, presented as a trustworthy, calm surface. No red
 * banners, no alarms — confidence and restraint.
 */
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { Approval } from "@/lib/types";
import { NebulaButton } from "@/components/primitives/NebulaButton";

interface Props {
  approval: Approval;
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalPanel({ approval, busy, onApprove, onReject }: Props) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="surface overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-void-line)] px-4 py-3">
        <span
          className="grid size-6 place-items-center rounded-full"
          style={{ background: "rgba(33,150,243,0.10)", color: "var(--color-accent-300)" }}
        >
          <ShieldCheck className="size-3.5" />
        </span>
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Confirm action
          </div>
          <div className="text-[14px] font-semibold text-strong">
            Nebula is ready to act.
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-[13px] leading-relaxed text-muted">
          {approval.description}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {approval.action_type && <span className="chip-active">{approval.action_type}</span>}
          <span className="chip">{approval.target_origin}</span>
          <span className="chip">{approval.risk_level} risk</span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <NebulaButton variant="primary" onClick={onApprove} loading={busy}>
            Confirm action
          </NebulaButton>
          <NebulaButton variant="ghost" onClick={onReject} disabled={busy}>
            Reject
          </NebulaButton>
        </div>
      </div>
    </motion.div>
  );
}
