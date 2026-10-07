import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`min-h-[38px] rounded-[var(--radius-control)] border border-[var(--soc-border)] bg-[var(--soc-surface-2)] px-3 py-1.5 text-sm text-[var(--soc-ink)] placeholder:text-[var(--soc-ink-faint)] focus:border-[var(--soc-accent)] focus:bg-[var(--soc-surface)] focus:shadow-[0_0_8px_var(--soc-accent-glow)] focus:outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
        {...props}
      />
    );
  },
);
