import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "default" | "outline" | "danger" | "secondary" | "ghost";
export type ButtonSize = "sm" | "default" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", className = "", ...props },
  ref,
) {
  const variantStyles: Record<ButtonVariant, string> = {
    default:
      "bg-[var(--soc-accent)] text-[var(--soc-accent-ink)] font-semibold border border-[var(--soc-accent)]/80 hover:brightness-110 hover:shadow-[0_0_12px_var(--soc-accent-glow)]",
    outline:
      "bg-[var(--soc-surface)] border border-[var(--soc-border-strong)] text-[var(--soc-ink)] hover:bg-[var(--soc-surface-2)] hover:border-[var(--soc-ink-dim)] shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
    danger:
      "bg-[var(--soc-sev-p1)] text-white font-semibold border border-[var(--soc-sev-p1)] hover:brightness-110 hover:shadow-[0_0_14px_rgba(239,68,68,0.35)]",
    secondary:
      "bg-[var(--soc-surface-2)] border border-[var(--soc-border)] text-[var(--soc-ink)] hover:bg-[var(--soc-surface-3)] hover:border-[var(--soc-cyan)]",
    ghost:
      "bg-transparent text-[var(--soc-ink-dim)] hover:text-[var(--soc-ink)] hover:bg-[var(--soc-surface-2)]",
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-2.5 py-1 text-xs min-h-[32px]",
    default: "px-3.5 py-1.5 text-sm min-h-[38px]",
    lg: "px-5 py-2.5 text-base min-h-[44px]",
  };

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] select-none cursor-pointer tracking-tight active:translate-y-[1px] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--soc-accent)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40 transition-[transform,box-shadow,border-color,background-color,filter] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    />
  );
});
