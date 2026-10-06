export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--soc-surface-2)] ${className}`} />;
}
