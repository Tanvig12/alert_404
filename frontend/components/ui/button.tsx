import { ButtonHTMLAttributes, forwardRef } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "danger" }
>(function Button({ variant = "default", className = "", ...props }, ref) {
  const styles =
    variant === "outline"
      ? "border border-[var(--soc-border-strong)] text-[var(--soc-ink)] hover:bg-[var(--soc-surface-2)]"
      : variant === "danger"
        ? "bg-[var(--soc-sev-p1)] text-[var(--soc-ink)] hover:brightness-110"
        : "bg-[var(--soc-accent)] text-[var(--soc-accent-ink)] hover:brightness-105";
  return (
    <button
      ref={ref}
      className={`rounded-[var(--soc-radius)] px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
});
