'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="m-4">
      <p className="text-sm text-[var(--soc-sev-p1)]">Something went wrong: {error.message}</p>
      <button className="mt-2 text-[var(--soc-accent)]" onClick={reset}>
        retry
      </button>
    </main>
  );
}
