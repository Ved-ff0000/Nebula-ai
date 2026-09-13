"use client";
/**
 * TaskComposer — the new-task input. Used on /tasks and inline. Restrained,
 * one text area + one primary action. Domain chips below the input.
 */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { NebulaTextarea } from "@/components/primitives/NebulaInput";
import { NebulaButton } from "@/components/primitives/NebulaButton";
import { motion } from "framer-motion";

interface Props {
  onSubmit: (goal: string) => void;
  defaultDomain?: string;
}

const SUGGESTIONS = [
  "List ML internships in Hyderabad with stipend and eligibility",
  "Fill the feedback form on /demo/feedback with rating 5",
  "Compare RTX 4060 laptops under ₹80,000 on Amazon and Flipkart",
];

export function TaskComposer({ onSubmit, defaultDomain }: Props) {
  const [goal, setGoal] = useState("");

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center gap-2 text-faint">
        <Sparkles className="size-3.5 text-[var(--color-accent-300)]" />
        <span className="mono text-[10px] uppercase tracking-[0.18em]">
          New mission
        </span>
        {defaultDomain && <span className="chip-active ml-auto">{defaultDomain}</span>}
      </div>

      <NebulaTextarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="What should Nebula do? Be specific about the success criteria…"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <motion.button
            key={s}
            whileTap={{ scale: 0.97 }}
            onClick={() => setGoal(s)}
            className="chip text-muted hover:text-strong hover:border-[color:rgba(33,150,243,0.35)]"
          >
            {s}
          </motion.button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <NebulaButton
          variant="primary"
          onClick={() => goal.trim() && onSubmit(goal.trim())}
          disabled={!goal.trim()}
        >
          Start task
        </NebulaButton>
        <span className="text-[11px] text-faint">
          Nebula will plan, then execute. High-risk actions require your approval.
        </span>
      </div>
    </div>
  );
}
