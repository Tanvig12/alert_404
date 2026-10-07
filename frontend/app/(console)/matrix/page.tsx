'use client';

import Link from "next/link";
import { useEvaluation, useNavigator } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEVERITIES, bucketByTactic } from "@/lib/matrix-model";
import { GridIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const SEV_VAR: Record<string, string> = {
  P1: "var(--soc-sev-p1)",
  P2: "var(--soc-sev-p2)",
  P3: "var(--soc-sev-p3)",
  P4: "var(--soc-sev-p4)",
};

function alphaFor(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  const q = count / max;
  if (q <= 0.25) return 15;
  if (q <= 0.5) return 35;
  if (q <= 0.75) return 60;
  return 100;
}

export default function MatrixPage() {
  const nav = useNavigator();
  const evaluation = useEvaluation();
  if (nav.isLoading || evaluation.isLoading)
    return (
      <main className="mx-auto max-w-6xl p-4" aria-busy="true" aria-label="Loading matrix">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-3 h-72" />
      </main>
    );
  if (nav.isError)
    return (
      <main className="mx-auto max-w-6xl p-4">
        <div className="soc-card p-5" role="alert">
          <p className="text-sm font-medium text-[var(--soc-sev-p1)]">Matrix failed to load.</p>
          <button type="button" onClick={() => nav.refetch()} className="mt-2 text-sm text-[var(--soc-accent)] underline underline-offset-2">
            Retry matrix
          </button>
        </div>
      </main>
    );
  const techs = (nav.data?.techniques ?? []) as Array<{ techniqueID: string; score: number }>;
  const rows = bucketByTactic(techs);
  const max = Math.max(0, ...rows.flat().map((c) => c.count));
  const ev = (evaluation.data ?? {}) as { f1?: unknown; precision?: unknown; recall?: unknown };
  const covered = rows.flat().filter((c) => c.count > 0).length;
  const total = Math.max(1, rows.flat().length);

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono-soc flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
            <GridIcon className="h-3.5 w-3.5" /> tactic × severity
          </p>
          <h1 className="font-display-soc text-xl font-bold tracking-tight">ATT&amp;CK Matrix</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">coverage {Math.round((covered / total) * 100)}%</Badge>
          <Badge tone="p1">F1 {String(ev.f1 ?? "—")}</Badge>
          <Badge tone="dim">precision {String(ev.precision ?? "—")}</Badge>
          <Badge tone="dim">recall {String(ev.recall ?? "—")}</Badge>
        </div>
      </div>
      <div className="soc-card soc-reveal mt-3 overflow-x-auto p-3">
        <table className="soc min-w-[560px]">
          <thead>
            <tr>
              <th className="w-40">Tactic</th>
              {SEVERITIES.map((s) => (
                <th key={s} className="text-center">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells) => (
              <tr key={cells[0].tactic} className="transition-[background-color] duration-150 hover:bg-[var(--soc-surface-2)]">
                <td className="font-mono-soc text-xs text-[var(--soc-ink-dim)]">{cells[0].tactic}</td>
                {cells.map((c) => {
                  const alpha = alphaFor(c.count, max);
                  const bg =
                    alpha === 0
                      ? "transparent"
                      : alpha === 100
                        ? SEV_VAR[c.severity]
                        : `color-mix(in srgb, ${SEV_VAR[c.severity]} ${alpha}%, var(--soc-surface))`;
                  const inner =
                    c.count > 0 && c.topTechnique ? (
                      <Link
                        href={`/incidents?technique=${encodeURIComponent(c.topTechnique)}`}
                        className="font-mono-soc block rounded-[var(--radius-tight)] px-2 py-1.5 text-center text-sm font-bold tabular-nums text-[var(--soc-ink)] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                        title={`${c.topTechnique} — ${c.count} incidents`}
                      >
                        {c.count}
                      </Link>
                    ) : (
                      <span className="block px-2 py-1.5 text-center text-sm text-[var(--soc-ink-faint)]">
                        —
                      </span>
                    );
                  return (
                    <td key={c.severity} style={{ background: bg }} className="rounded-[var(--radius-tight)] p-0.5">
                      {inner}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono-soc mt-3 text-[11px] tracking-wide text-[var(--soc-ink-faint)]">
        F1 {String(ev.f1 ?? "—")} — cell intensity scales with incident volume; select a cell to triage that technique
      </p>
    </main>
  );
}
