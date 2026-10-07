'use client';

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard, useEvaluation, useIncident } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraphPanel } from "@/components/graph-panel";
import { ActivityIcon, AlertTriangleIcon, ArrowIcon, CheckCircleIcon, RefreshIcon } from "@/components/icons";

const KPI_DEFS = [
  { key: "total_alerts", label: "alerts processed", tint: "text-[var(--soc-ink)]", delta: "+burst feed" },
  { key: "total_incidents", label: "incidents formed", tint: "text-[var(--soc-ink)]", delta: "entity merge" },
  { key: "high_risk", label: "high risk P1–P2", tint: "text-[var(--soc-sev-p2)]", delta: "triage now" },
  { key: "critical", label: "critical P1", tint: "text-[var(--soc-sev-p1)]", delta: "escalate" },
  { key: "reduction_pct", label: "noise reduction %", tint: "text-[var(--soc-ok)]", delta: "correlator" },
] as const;

type TopIncident = {
  id: string;
  risk_score?: number;
  severity?: string;
  asset_id?: string;
  primary_technique?: string;
};

const SEV_RAIL: Record<string, string> = {
  P1: "soc-rail-p1",
  P2: "soc-rail-p2",
  P3: "soc-rail-p3",
  P4: "soc-rail-p4",
};

const SEV_TONE: Record<string, "p1" | "p2" | "p3" | "p4"> = {
  P1: "p1",
  P2: "p2",
  P3: "p3",
  P4: "p4",
};

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
        setBusy(false);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={run} disabled={busy} aria-live="polite">
        <RefreshIcon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "processing…" : "Process 3,000 alerts"}
      </Button>
      {result && (
        <span role="status" className="font-mono-soc inline-flex items-center gap-1.5 text-xs text-[var(--soc-ok)]">
          <CheckCircleIcon className="h-3.5 w-3.5" /> {result}
        </span>
      )}
      {error && (
        <span role="alert" className="inline-flex items-center gap-1.5 text-xs text-[var(--soc-sev-p1)]">
          <AlertTriangleIcon className="h-3.5 w-3.5" /> {error}
          <button
            type="button"
            onClick={run}
            className="underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </span>
      )}
    </div>
  );
}

function Sparkline({ seed = 1 }: { seed?: number }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const v = 14 + ((seed * (i + 3) * 37) % 20);
    return `${i * 10},${34 - v}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 110 36" className="h-8 w-24" aria-hidden="true" focusable="false">
      <polyline points={pts} fill="none" stroke="var(--soc-accent)" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}

function QueueCards({ incidents }: { incidents: TopIncident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="soc-card p-5" role="status">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-border)] bg-[var(--soc-surface-2)] text-[var(--soc-ink-faint)]">
          <ActivityIcon className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-[var(--soc-ink)]">Queue is clear</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-[var(--soc-ink-dim)]">
          No incidents yet. Run an analysis to form the triage queue.
        </p>
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {incidents.map((inc, i) => (
        <li key={inc.id}>
          <Link
            href={`/incidents/${inc.id}`}
            className={`soc-card group block p-3 transition-[transform,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:border-[var(--soc-border-strong)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${inc.severity ? SEV_RAIL[inc.severity] ?? "" : ""}`}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-soc text-sm font-semibold text-[var(--soc-ink)]">{inc.id}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono-soc text-xs tabular-nums text-[var(--soc-ink-dim)]">
                  risk {String(inc.risk_score ?? "—")}
                </span>
                <Badge tone={(inc.severity ? SEV_TONE[inc.severity] : undefined) ?? "p4"}>{inc.severity ?? "—"}</Badge>
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--soc-ink-dim)]">
              <span className="font-mono-soc">{inc.asset_id ?? "—"}</span>
              {inc.primary_technique && (
                <span className="font-mono-soc text-[var(--soc-cyan)]">{inc.primary_technique}</span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-[var(--soc-accent)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Open <ArrowIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function DockGraph({ id }: { id: string }) {
  const inc = useIncident(id);
  if (inc.isLoading) return <Skeleton className="h-[320px]" />;
  if (inc.isError)
    return (
      <div className="p-4" role="alert">
        <p className="text-sm text-[var(--soc-sev-p1)]">Graph failed to load.</p>
        <button type="button" onClick={() => inc.refetch()} className="mt-2 text-sm text-[var(--soc-accent)] underline underline-offset-2">
          Retry graph
        </button>
      </div>
    );
  if (!inc.data) return <p className="p-4 text-sm text-[var(--soc-ink-faint)]">No graph data.</p>;
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
      <p className="text-xs leading-relaxed text-[var(--soc-ink-faint)]">
        Severity mix appears here right after an analysis run.
      </p>
    );
  }
  const max = Math.max(...entries.map(([, c]) => c), 1);
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([sev, c]) => (
        <div key={sev} className="flex items-center gap-2 text-xs">
          <span className="font-mono-soc w-16 shrink-0 text-[var(--soc-ink-dim)]">{sev}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-[var(--radius-tight)] bg-[var(--soc-surface-3)]">
            <div
              className="h-3 rounded-[var(--radius-tight)]"
              style={{ width: `${(c / max) * 100}%`, background: SEV_FILL[sev] ?? "var(--soc-ink-faint)" }}
            />
          </div>
          <span className="font-mono-soc w-12 shrink-0 text-right tabular-nums text-[var(--soc-ink)]">{c}</span>
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
            className="font-mono-soc w-20 shrink-0 text-[var(--soc-cyan)] hover:underline"
          >
            {t.id}
          </Link>
          <div className="h-3 flex-1 overflow-hidden rounded-[var(--radius-tight)] bg-[var(--soc-surface-3)]">
            <div
              className="h-3 rounded-[var(--radius-tight)] bg-[var(--soc-cyan)]"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
          </div>
          <span className="font-mono-soc w-12 shrink-0 text-right tabular-nums text-[var(--soc-ink)]">{t.count}</span>
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
          <p className="font-mono-soc text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
            live operations
          </p>
          <h1 className="font-display-soc text-xl font-bold tracking-tight">SOC Sentinel — Command Center</h1>
          <p className="font-mono-soc mt-0.5 text-[11px] tracking-wide text-[var(--soc-ink-dim)]">
            queue {String((d.high_risk as number) ?? "—")} high-risk ·{" "}
            {String((d.critical as number) ?? "—")} critical
          </p>
        </div>
        <AnalyzePanel />
      </div>

      <section className="mt-4" aria-label="Key metrics">
        {dash.isLoading && !initial ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-busy="true" aria-label="Loading metrics">
            {KPI_DEFS.map((k) => (
              <Skeleton key={k.key} className="h-[104px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {KPI_DEFS.map((k, i) => (
              <div
                key={k.key}
                className={`soc-card soc-reveal p-4 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono-soc text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
                    {k.label}
                  </p>
                  <span className="font-mono-soc text-[10px] uppercase tracking-wide text-[var(--soc-ink-faint)]">
                    {k.delta}
                  </span>
                </div>
                <p className={`font-mono-soc mt-1 text-[28px] font-bold tabular-nums ${k.tint}`}>
                  {String(d[k.key] ?? "—")}
                </p>
                <div className="mt-1">
                  <Sparkline seed={i + 1} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-label="Triage queue">
          <div className="flex items-center justify-between">
            <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
              Triage queue
            </h2>
            <Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--soc-accent)] hover:underline">
              Full queue <ArrowIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-2">
            {dash.isLoading && !initial ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading queue">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[76px]" />
                ))}
              </div>
            ) : (
              <QueueCards incidents={top} />
            )}
          </div>
        </section>
        <section className="lg:col-span-5" aria-label="Top P1 attack graph">
          <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
            Top P1 — attack graph
          </h2>
          <div className="soc-card mt-2 overflow-hidden p-2">
            {!topP1 ? (
              <p className="p-3 text-sm text-[var(--soc-ink-faint)]" role="status">
                No P1 incidents yet. Run an analysis.
              </p>
            ) : (
              <DockGraph id={topP1.id} />
            )}
          </div>
        </section>
      </div>

      <section className="mt-6" aria-label="Detection evaluation">
        <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
          Detection evaluation
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="p1">F1 {String(ev.f1 ?? "—")}</Badge>
          <Badge tone="p2">precision {String(ev.precision ?? "—")}</Badge>
          <Badge tone="accent">recall {String(ev.recall ?? "—")}</Badge>
          <Badge tone="dim">brain {String(ev.brain ?? (d.brain as string) ?? "—")}</Badge>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Distributions">
        <div className="soc-card p-4">
          <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
            Severity distribution
          </h2>
          <div className="mt-3">
            <SeverityBars counts={(d.severity_counts ?? {}) as Record<string, number>} />
          </div>
        </div>
        <div className="soc-card p-4">
          <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
            Top techniques
          </h2>
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
