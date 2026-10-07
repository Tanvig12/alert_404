export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading content"
      className={`animate-pulse rounded-[var(--radius-inset)] border border-[var(--soc-border-subtle)] bg-[var(--soc-surface-2)] ${className}`}
    />
  );
}
