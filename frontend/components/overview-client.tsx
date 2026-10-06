'use client';

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard, useEvaluation, useIncident } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraphPanel } from "@/components/graph-panel";

const KPI_DEFS = [
  { key: "total_alerts", label: "alerts processed", tint: "text-[var(--soc-ink)]" },
  { key: "total_incidents", label: "incidents formed", tint: "text-[var(--soc-ink)]" },
  { key: "high_risk", label: "high risk P1–P2", tint: "text-[var(--soc-sev-p2)]" },
  { key: "critical", label: "critical P1", tint: "text-[var(--soc-sev-p1)]" },
  { key: "reduction_pct", label: "noise reduction %", tint: "text-[var(--soc-ok)]" },
] as const;

type TopIncident = {
  id: string;
  risk_score?: number;
  severity?: string;
  asset_id?: string;
  primary_technique?: string;
};

function railFor(sev?: string) {
  if (sev === "P1") return "soc-rail-p1";
  if (sev === "P2") return "soc-rail-p2";
  if (sev === "P3") return "soc-rail-p3";
  if (sev === "P4") return "soc-rail-p4";
  return "";
}

function AnalyzePanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch("/api/soc/generate?count=3000", { method: "POST" });
      const body = await r.json();
      if (!r.ok) {
        setError(String(body?.detail ?? `generate: ${r.status}`));
        return;
      }
      const incidents = (body?.incidents ?? []) as Array<{ severity?: string }>;
      const p1 = incidents.filter((i) => i.severity === "P1").length;
      setResult(`incidents=${incidents.length} P1=${p1}`);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["evaluation"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "generate failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={run} disabled={busy}>
        {busy ? "processing…" : "Process 3,000 alerts"}
      </Button>
      {result && <span className="text-sm text-[var(--soc-ok)]">{result}</span>}
      {error && <span className="text-sm text-[var(--soc-sev-p1)]">{error}</span>}
    </div>
  );
}

function QueueCards({ incidents }: { incidents: TopIncident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="soc-card p-4">
        <p className="text-sm text-[var(--soc-ink-dim)]">
          No incidents yet. Run an analysis to form the triage queue.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {incidents.map((inc) => (
        <Link
          key={inc.id}
          href={`/incidents/${inc.id}`}
          className={`soc-card block p-3 hover:border-[var(--soc-border-strong)] ${railFor(inc.severity)}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-soc text-sm text-[var(--soc-ink)]">{inc.id}</span>
            <Badge tone={(inc.severity ?? "P4").toLowerCase() as "p1" | "p2" | "p3" | "p4"}>{inc.severity ?? "—"}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--soc-ink-dim)]">
            <span className="font-mono-soc">{inc.asset_id ?? "—"}</span>
            <span>
              risk <span className="font-mono-soc text-[var(--soc-ink)]">{String(inc.risk_score ?? "—")}</span>
            </span>
            {inc.primary_technique && (
              <span className="font-mono-soc text-[var(--soc-accent)]">{inc.primary_technique}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function DockGraph({ id }: { id: string }) {
  const inc = useIncident(id);
  if (inc.isLoading) return <Skeleton className="h-[320px]" />;
  if (!inc.data) return <p className="text-sm text-[var(--soc-ink-faint)]">No graph data.</p>;
  const d = inc.data as { graph?: { nodes: []; edges: [] }; status?: string };
  return <GraphPanel graph={d.graph} status={String(d.status ?? "open")} height={320} />;
}

const SEV_FILL: Record<string, string> = {
  Critical: "var(--soc-sev-p1)",
  High: "var(--soc-sev-p2)",
  Medium: "var(--soc-sev-p3)",
  Low: "var(--soc-sev-p4)",
  P1: "var(--soc-sev-p1)",
  P2: "var(--soc-sev-p2)",
  P3: "var(--soc-sev-p3)",
  P4: "var(--soc-sev-p4)",
};

function SeverityBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-[var(--soc-ink-faint)]">
        Severity mix appears here right after an analysis run.
      </p>
    );
  }
  const max = Math.max(...entries.map(([, c]) => c), 1);
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([sev, c]) => (
        <div key={sev} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 font-mono-soc text-[var(--soc-ink-dim)]">{sev}</span>
          <div className="h-3 flex-1 rounded bg-[var(--soc-surface-2)]">
            <div
              className="h-3 rounded"
              style={{ width: `${(c / max) * 100}%`, background: SEV_FILL[sev] ?? "var(--soc-ink-faint)" }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono-soc text-[var(--soc-ink)]">{c}</span>
        </div>
      ))}
    </div>
  );
}

function TechniqueBars({ techniques }: { techniques: Array<{ id: string; count: number }> }) {
  const top = techniques.slice(0, 8);
  if (top.length === 0) {
    return <p className="text-xs text-[var(--soc-ink-faint)]">No techniques observed yet.</p>;
  }
  const max = Math.max(...top.map((t) => t.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {top.map((t) => (
        <div key={t.id} className="flex items-center gap-2 text-xs">
          <Link
            href={`/incidents?technique=${encodeURIComponent(t.id)}`}
            className="w-20 shrink-0 font-mono-soc text-[var(--soc-accent)]"
          >
            {t.id}
          </Link>
          <div className="h-3 flex-1 rounded bg-[var(--soc-surface-2)]">
            <div
              className="h-3 rounded"
              style={{ width: `${(t.count / max) * 100}%`, background: "var(--soc-accent)" }}
            />
          </div>
          <span className="w-12 shrink-0 text-right font-mono-soc text-[var(--soc-ink)]">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function OverviewClient({ initial }: { initial: unknown }) {
  const dash = useDashboard();
  const evaluation = useEvaluation();
  const d = (dash.data ?? initial ?? {}) as Record<string, unknown>;
  const ev = (evaluation.data ?? {}) as Record<string, unknown>;
  const top = (d.top_incidents ?? []) as TopIncident[];
  const topP1 = top.find((t) => t.severity === "P1");

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="soc-sticky -mx-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold">SOC Sentinel — Command Center</h1>
          <p className="text-xs text-[var(--soc-ink-dim)]">
            queue {String((d.high_risk as number) ?? "—")} high-risk ·{" "}
            {String((d.critical as number) ?? "—")} critical
          </p>
        </div>
        <AnalyzePanel />
      </div>

      <section className="soc-reveal mt-4">
        <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Key metrics</h2>
        {dash.isLoading && !initial ? (
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
            {KPI_DEFS.map((k) => (
              <Skeleton key={k.key} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
            {KPI_DEFS.map((k) => (
              <div key={k.key} className="soc-card p-3">
                <p className="text-xs text-[var(--soc-ink-faint)]">{k.label}</p>
                <p className={`text-2xl font-semibold ${k.tint}`}>{String(d[k.key] ?? "—")}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="soc-reveal">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Triage queue</h2>
          <div className="mt-2">
            {dash.isLoading && !initial ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <QueueCards incidents={top} />
            )}
          </div>
        </section>
        <section className="soc-reveal">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Top P1 — attack graph</h2>
          <div className="soc-card mt-2 p-2">
            {!topP1 ? (
              <p className="p-2 text-sm text-[var(--soc-ink-faint)]">
                No P1 incidents yet. Run an analysis.
              </p>
            ) : (
              <DockGraph id={topP1.id} />
            )}
          </div>
        </section>
      </div>

      <section className="soc-reveal mt-6">
        <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Detection evaluation</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="p1">F1 {String(ev.f1 ?? "—")}</Badge>
          <Badge tone="p2">precision {String(ev.precision ?? "—")}</Badge>
          <Badge tone="accent">recall {String(ev.recall ?? "—")}</Badge>
          <Badge tone="dim">brain {String(ev.brain ?? (d.brain as string) ?? "—")}</Badge>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="soc-card soc-reveal p-4">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Severity distribution</h2>
          <div className="mt-3">
            <SeverityBars counts={(d.severity_counts ?? {}) as Record<string, number>} />
          </div>
        </div>
        <div className="soc-card soc-reveal p-4">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Top techniques</h2>
          <div className="mt-3">
            <TechniqueBars
              techniques={(d.techniques ?? []) as Array<{ id: string; count: number }>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
