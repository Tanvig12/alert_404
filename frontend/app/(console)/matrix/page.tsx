'use client';

import Link from "next/link";
import { useEvaluation, useNavigator } from "@/hooks/useSoc";
import { Skeleton } from "@/components/ui/skeleton";
import { SEVERITIES, bucketByTactic } from "@/lib/matrix-model";

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
  if (nav.isLoading || evaluation.isLoading) return <Skeleton className="m-4 h-64" />;
  const techs = (nav.data?.techniques ?? []) as Array<{ techniqueID: string; score: number }>;
  const rows = bucketByTactic(techs);
  const max = Math.max(0, ...rows.flat().map((c) => c.count));

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="text-xl font-semibold">ATT&amp;CK Matrix — tactic × severity</h1>
      <div className="soc-card mt-4 overflow-x-auto p-4">
        <table className="soc min-w-[560px]">
          <thead>
            <tr>
              <th>Tactic</th>
              {SEVERITIES.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells) => (
              <tr key={cells[0].tactic}>
                <td className="text-xs text-[var(--soc-ink-dim)]">{cells[0].tactic}</td>
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
                        className="block rounded px-2 py-1.5 text-center font-mono-soc text-sm text-[var(--soc-ink)]"
                      >
                        {c.count}
                      </Link>
                    ) : (
                      <span className="block px-2 py-1.5 text-center text-sm text-[var(--soc-ink-faint)]">
                        —
                      </span>
                    );
                  return (
                    <td key={c.severity} style={{ background: bg }} className="rounded">
                      {inner}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--soc-ink-faint)]">
        F1 {String((evaluation.data as Record<string, unknown> | undefined)?.f1 ?? "—")} — cell
        click opens filtered Incidents with the technique in the URL.
      </p>
    </main>
  );
}
