import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`rounded-[var(--soc-radius)] border border-[var(--soc-border-strong)] bg-[var(--soc-surface)] px-2 py-1.5 text-sm text-[var(--soc-ink)] placeholder:text-[var(--soc-ink-faint)] ${className}`}
        {...props}
      />
    );
  },
);
