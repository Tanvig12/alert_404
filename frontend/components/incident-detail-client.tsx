'use client';

import Link from "next/link";
import { useState } from "react";
import { useAnalystAction, useIncident } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GraphPanel } from "@/components/graph-panel";
import { AlertTriangleIcon, ArrowIcon, CheckCircleIcon, ShieldIcon } from "@/components/icons";

const PAGE = 50;

type EvidenceItem = { alert_id?: string; event_type?: string; hostname?: string };

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asEvidence(v: unknown): EvidenceItem[] {
  if (!Array.isArray(v)) return [];
  const out: EvidenceItem[] = [];
  for (const x of v) {
    if (typeof x === "string") out.push({ alert_id: x });
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      out.push({
        alert_id: typeof o.alert_id === "string" ? o.alert_id : undefined,
        event_type: typeof o.event_type === "string" ? o.event_type : undefined,
        hostname: typeof o.hostname === "string" ? o.hostname : undefined,
      });
    }
  }
  return out;
}

export function BriefSection({ brief }: { brief: Record<string, unknown> }) {
  const headline = typeof brief.headline === "string" ? brief.headline : null;
  const summary = typeof brief.executive_summary === "string" ? brief.executive_summary : null;
  const hypothesis = typeof brief.attack_hypothesis === "string" ? brief.attack_hypothesis : null;
  const evidence = asEvidence(brief.key_evidence);
  const techniques = asStrings(brief.mitre_attack);
  const actions = asStrings(brief.recommended_actions);
  const questions = asStrings(brief.analyst_questions);
  const severity = typeof brief.severity === "string" ? brief.severity : null;
  const confidence = typeof brief.confidence === "number" ? brief.confidence : null;
  const provider = typeof brief.provider === "string" ? brief.provider : null;
  const model = typeof brief.model === "string" ? brief.model : null;
  const jev = brief.jev as { needs_escalation?: number; disposition?: string; source?: string } | null | undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="brief-section">
      {headline && (
        <h2 className="font-display-soc max-w-[65ch] text-2xl font-bold leading-tight tracking-tight text-[var(--soc-ink)]">
          {headline}
        </h2>
      )}
      {summary && <p className="max-w-[70ch] text-sm leading-relaxed text-[var(--soc-ink-dim)]">{summary}</p>}
      {hypothesis && (
        <div className="soc-card soc-rail-p2 p-4">
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
            Attack hypothesis
          </p>
          <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-[var(--soc-ink)]">{hypothesis}</p>
        </div>
      )}
      {evidence.length > 0 && (
        <div>
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
            Key evidence
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidence.map((e, i) => (
              <span key={i} className="soc-badge font-mono-soc">
                {e.alert_id ?? "—"}
                {e.event_type ? ` · ${e.event_type}` : ""}
                {e.hostname ? ` · ${e.hostname}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {techniques.length > 0 && (
        <div>
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
            MITRE ATT&amp;CK
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {techniques.map((t) => (
              <Link
                key={t}
                href={`/incidents?technique=${encodeURIComponent(t)}`}
                className="soc-badge soc-badge-accent font-mono-soc transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px]"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      )}
      {actions.length > 0 && (
        <div className="soc-card border-[var(--soc-ok)]/25 p-4">
          <p className="font-mono-soc flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ok)]">
            <ShieldIcon className="h-3.5 w-3.5" /> Recommended actions
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--soc-ink)]">
                <span className="font-mono-soc mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-tight)] border border-[var(--soc-ok)]/40 bg-[var(--soc-ok)]/10 text-[10px] font-bold text-[var(--soc-ok)]">
                  {i + 1}
                </span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {questions.length > 0 && (
        <div className="soc-inset p-4">
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
            Analyst questions
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-[var(--soc-ink-dim)]">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {(severity || confidence !== null) && (
        <div className="flex flex-wrap items-center gap-3">
          {severity && <Badge tone="p1">{severity}</Badge>}
          {confidence !== null && (
            <div className="flex min-w-40 flex-1 items-center gap-2 text-xs text-[var(--soc-ink-dim)]">
              <span className="font-mono-soc uppercase tracking-wide">confidence</span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-[var(--radius-tight)] bg-[var(--soc-surface-3)]"
                role="meter"
                aria-valuenow={Math.round(confidence * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Brief confidence"
              >
                <div
                  className="h-2 rounded-[var(--radius-tight)] bg-[var(--soc-accent)]"
                  style={{ width: `${Math.min(100, Math.max(0, confidence * 100))}%` }}
                />
              </div>
              <span className="font-mono-soc tabular-nums text-[var(--soc-ink)]">{confidence}</span>
            </div>
          )}
        </div>
      )}
      {(provider || model || jev) && (
        <p className="font-mono-soc text-[11px] tracking-wide text-[var(--soc-ink-faint)]">
          provider={provider ?? "?"} model={model ?? "?"}
          {jev && ` · triage=${String(jev.disposition)} (${String(jev.source)})`}
        </p>
      )}
    </div>
  );
}

function RiskBars({ factors }: { factors: Record<string, unknown> }) {
  const entries = Object.entries(factors);
  if (entries.length === 0) return null;
  return (
    <div className="soc-card p-4">
      <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">Risk factors</h2>
      <div className="mt-3 flex flex-col gap-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="font-mono-soc w-32 shrink-0 truncate text-[var(--soc-ink-dim)]">{k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-tight)] bg-[var(--soc-surface-3)]">
              <div
                className="h-2 rounded-[var(--radius-tight)] bg-[var(--soc-accent)]"
                style={{ width: `${Math.min(100, Number(v) || 0)}%` }}
              />
            </div>
            <span className="font-mono-soc tabular-nums text-[var(--soc-ink)]">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncidentDetailClient({ id }: { id: string }) {
  const q = useIncident(id);
  const { act, busy } = useAnalystAction();
  const [note, setNote] = useState("");
  const [page, setPage] = useState(0);

  if (q.isLoading)
    return (
      <main className="mx-auto max-w-6xl p-4" aria-busy="true" aria-label="Loading incident">
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-7" />
          <Skeleton className="h-96 lg:col-span-5" />
        </div>
      </main>
    );
  if (q.isError)
    return (
      <main className="mx-auto max-w-6xl p-4">
        <div className="soc-card p-5" role="alert">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--soc-sev-p1)]">
            <AlertTriangleIcon className="h-4 w-4" /> Incident failed to load.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
            Retry incident
          </Button>
        </div>
      </main>
    );
  if (!q.data) return <p className="m-4">Incident not found.</p>;
  const d = q.data as Record<string, unknown>;
  const brief = (d.ai_brief ?? {}) as Record<string, unknown>;
  const factors = (d.risk_factors ?? {}) as Record<string, unknown>;
  const jev = brief.jev as
    | { needs_escalation?: number; disposition?: string; source?: string }
    | null
    | undefined;
  const alerts = (d.alerts ?? []) as Array<Record<string, unknown>>;
  const shown = alerts.slice(page * PAGE, page * PAGE + PAGE);
  const sev = String(d.severity ?? "P4");

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/incidents" className="inline-flex items-center gap-1 text-xs text-[var(--soc-ink-faint)] hover:text-[var(--soc-accent)]">
            <ArrowIcon className="h-3.5 w-3.5 rotate-180" /> queue
          </Link>
          <h1 className="font-display-soc mt-1 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
            <span className="font-mono-soc">{String(d.id)}</span>
            <Badge tone={sev.toLowerCase() as "p1" | "p2" | "p3" | "p4"}>
              {sev}
            </Badge>
            {jev && (jev.needs_escalation ?? 0) >= 0.8 && <Badge tone="p1" pulse>AI escalate</Badge>}
          </h1>
        </div>
        <Badge tone="dim">status: {String(d.status)}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
          <section aria-label="AI brief">
            <BriefSection brief={brief} />
          </section>

          <section aria-label="Evidence timeline">
            <h2 className="font-display-soc text-sm font-bold tracking-tight text-[var(--soc-ink)]">
              Evidence timeline ({alerts.length})
            </h2>
            <div className="soc-card mt-2 overflow-x-auto">
              <table className="soc min-w-[520px]">
              <thead>
                <tr>
                  <th>Alert</th>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={String(a.alert_id)}>
                    <td className="font-mono-soc font-medium text-[var(--soc-ink)]">{String(a.alert_id)}</td>
                    <td className="font-mono-soc">{String(a.timestamp)}</td>
                    <td className="font-mono-soc text-[var(--soc-cyan)]">{String(a.event_type)}</td>
                    <td>{String(a.severity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mt-2 flex items-center gap-2 no-print">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                prev
              </Button>
              <span className="font-mono-soc text-[11px] text-[var(--soc-ink-faint)]">
                {page + 1} / {Math.max(1, Math.ceil(alerts.length / PAGE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE >= alerts.length}
                onClick={() => setPage(page + 1)}
              >
                next
              </Button>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-16 lg:col-span-5" aria-label="Graph and actions">
          <RiskBars factors={factors} />

          <div className="soc-card overflow-hidden p-2">
            <GraphPanel
              graph={d.graph as { nodes: []; edges: [] }}
              status={String(d.status)}
              height={380}
            />
          </div>

          <div className="soc-card border-[var(--soc-accent)]/25 p-4 no-print" aria-label="Analyst actions">
            <p className="font-mono-soc flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[var(--soc-accent)]">
              <CheckCircleIcon className="h-3.5 w-3.5" /> human in the loop
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                variant="outline"
                onClick={() => act(id, "acknowledge", note)}
              >
                acknowledge
              </Button>
              <Button
                size="sm"
                disabled={busy}
                variant="default"
                onClick={() => act(id, "escalate", note)}
              >
                escalate
              </Button>
              <Button
                size="sm"
                disabled={busy}
                variant="danger"
                onClick={() => act(id, "false_positive", note)}
              >
                false positive
              </Button>
            </div>
            <label className="mt-3 block">
              <span className="font-mono-soc text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
                analyst note
              </span>
              <Input
                placeholder="FP reason / note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
          </div>
        </aside>
      </div>
    </main>
  );
}
