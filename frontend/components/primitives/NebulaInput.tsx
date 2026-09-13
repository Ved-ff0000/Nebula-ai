"use client";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: React.ReactNode;
}
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const baseField =
  "w-full rounded-[var(--radius-md)] bg-[var(--color-void-soft)] " +
  "border border-[var(--color-void-line)] " +
  "px-3 py-2 text-[13px] tracking-[-0.005em] text-[var(--color-ink-strong)] " +
  "placeholder:text-[var(--color-ink-faint)] " +
  "transition-colors focus:border-[var(--color-accent-500)] focus:bg-[var(--color-void-panel)]";

export const NebulaInput = forwardRef<HTMLInputElement, InputProps>(function NebulaInput(
  { iconLeft, className = "", ...rest },
  ref,
) {
  return (
    <div className={"relative " + className}>
      {iconLeft && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]">
          {iconLeft}
        </span>
      )}
      <input
        ref={ref}
        className={
          (iconLeft ? "pl-9 " : "") +
          baseField
        }
        {...rest}
      />
    </div>
  );
});

export const NebulaTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function NebulaTextarea({ className = "", ...rest }, ref) {
    return <textarea ref={ref} className={baseField + " resize-y " + className} {...rest} />;
  },
);
