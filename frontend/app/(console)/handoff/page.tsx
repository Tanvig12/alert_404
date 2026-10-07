'use client';

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangleIcon, CheckCircleIcon, CopyIcon, DocIcon, PrinterIcon, SparklesIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

async function fetchHandoff(): Promise<string> {
  const r = await fetch("/api/soc/handoff.md");
  if (!r.ok) throw new Error(`handoff: ${r.status}`);
  return r.text();
}

interface ShiftSummary {
  executive_summary: string;
  now_watch: string[];
  next_shift_priorities: string[];
  detection_gaps: string[];
  signoff_notes: string;
  provider?: string;
  model?: string;
  fallback_used?: boolean;
  incident_count?: number;
}

async function fetchSummary(): Promise<ShiftSummary> {
  const r = await fetch("/api/soc/handoff/summary");
  if (!r.ok) throw new Error(`summary: ${r.status}`);
  return r.json();
}

function summaryMarkdown(s: ShiftSummary): string {
  const L = ["# Shift Summary", "", s.executive_summary, "",
    "## Watch now",
    ...s.now_watch.map((id) => `- ${id}`),
    "", "## Next shift priorities",
    ...s.next_shift_priorities.map((p, i) => `${i + 1}. ${p}`),
    "", "## Detection gaps",
    ...s.detection_gaps.map((g) => `- ${g}`),
    "", `## Sign-off`, s.signoff_notes, ""];
  return L.join("\n");
}

interface Section {
  title: string;
  rows: string[];
  checks: string[];
}

function parseSections(md: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.slice(3).trim(), rows: [], checks: [] };
    } else if (current) {
      const t = line.trim();
      if (t.startsWith("- [ ]") || t.startsWith("  - [ ]")) {
        current.checks.push(t.replace(/^\s*-\s*\[ \]\s*/, ""));
      } else if (t.startsWith("- **")) {
        current.rows.push(t);
      } else if (t.startsWith("- ")) {
        current.rows.push(t.slice(2));
      }
    }
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.rows.length > 0 || s.checks.length > 0);
}

function SectionCard({ section, index }: { section: Section; index: number }) {
  const [done, setDone] = useState<boolean[]>(section.checks.map(() => false));
  return (
    <section className="soc-card soc-reveal p-5" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }} aria-label={section.title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display-soc text-base font-bold tracking-tight text-[var(--soc-ink)]">{section.title}</h2>
        <span className="font-mono-soc text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      {section.rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {section.rows.map((r, i) => (
            <li key={i} className="soc-inset px-3 py-2 text-sm leading-relaxed text-[var(--soc-ink-dim)]">
              {r}
            </li>
          ))}
        </ul>
      )}
      {section.checks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {section.checks.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                aria-pressed={done[i]}
                onClick={() => setDone((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className="flex w-full items-start gap-2.5 rounded-[var(--radius-control)] border border-transparent px-2 py-1.5 text-left text-sm text-[var(--soc-ink)] transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--soc-border)] hover:bg-[var(--soc-surface-2)]"
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-tight)] border transition-[background-color,border-color,color] duration-150 ${
                    done[i]
                      ? "border-[var(--soc-ok)] bg-[var(--soc-ok)] text-[#04120c]"
                      : "border-[var(--soc-border-strong)] bg-transparent text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  <CheckCircleIcon className="h-3 w-3" />
                </span>
                <span className={done[i] ? "text-[var(--soc-ink-faint)] line-through" : ""}>{c}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShiftSummaryPanel() {
  const s = useQuery({ queryKey: ["handoff-summary"], queryFn: fetchSummary });

  if (s.isLoading)
    return (
      <div className="soc-card mt-4 p-5" aria-busy="true" aria-label="Loading shift summary">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );

  if (s.isError)
    return (
      <div className="soc-card mt-4 border-[var(--soc-sev-p2)]/30 p-5" role="alert">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--soc-sev-p2)]">
          <AlertTriangleIcon className="h-4 w-4" /> Shift summary unavailable.
        </p>
        <p className="mt-1 text-sm text-[var(--soc-ink-dim)]">
          The briefing cards below are unaffected — retry the summary fetch.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => s.refetch()}>
          Retry summary
        </Button>
      </div>
    );

  if (!s.data) return null;
  const d = s.data;
  const ai = d.provider === "openrouter";

  return (
    <section className="soc-card soc-reveal mt-4 border-[var(--soc-accent)]/25 p-5" aria-label="Shift summary" data-testid="shift-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display-soc flex items-center gap-2 text-base font-bold tracking-tight text-[var(--soc-ink)]">
          <SparklesIcon className="h-4 w-4 text-[var(--soc-accent)]" /> Shift summary
        </h2>
        <span className="flex items-center gap-2">
          {ai ? (
            <Badge tone="accent">AI · {String(d.model ?? "openrouter").split("/")[0]}</Badge>
          ) : (
            <Badge tone="dim">rules fallback</Badge>
          )}
          {typeof d.incident_count === "number" && (
            <span className="font-mono-soc text-[11px] text-[var(--soc-ink-faint)]">
              {d.incident_count} incidents
            </span>
          )}
        </span>
      </div>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-[var(--soc-ink)]">
        {d.executive_summary}
      </p>
      {d.now_watch.length > 0 && (
        <div className="mt-4">
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-sev-p1)]">
            Watch now
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.now_watch.map((id) => (
              <Link key={id} href={`/incidents/${id}`} className="soc-badge soc-badge-p1 font-mono-soc transition-[transform] duration-150 hover:-translate-y-[1px]">
                {id}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="soc-inset p-4">
          <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-accent)]">
            Next shift priorities
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {d.next_shift_priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--soc-ink)]">
                <span className="font-mono-soc mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-tight)] border border-[var(--soc-accent)]/40 bg-[var(--soc-accent)]/10 text-[10px] font-bold text-[var(--soc-accent)]">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <div className="soc-inset p-4">
            <p className="font-mono-soc text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-cyan)]">
              Detection gaps
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {d.detection_gaps.map((g, i) => (
                <li key={i} className="text-sm leading-relaxed text-[var(--soc-ink-dim)]">· {g}</li>
              ))}
            </ul>
          </div>
          <div className="soc-inset border-[var(--soc-ok)]/25 p-4">
            <p className="font-mono-soc flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--soc-ok)]">
              <CheckCircleIcon className="h-3.5 w-3.5" /> Sign-off
            </p>
            <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--soc-ink-dim)]">
              {d.signoff_notes}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HandoffPage() {
  const q = useQuery({ queryKey: ["handoff"], queryFn: fetchHandoff });
  const sq = useQuery({ queryKey: ["handoff-summary"], queryFn: fetchSummary });
  const [copied, setCopied] = useState(false);
  const sections = q.data ? parseSections(q.data) : [];

  function copyAll() {
    const parts = [];
    if (sq.data) parts.push(summaryMarkdown(sq.data));
    if (q.data) parts.push(q.data);
    if (parts.length > 0) {
      navigator.clipboard.writeText(parts.join("\n---\n\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono-soc flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
            <DocIcon className="h-3.5 w-3.5" /> operations briefing
          </p>
          <h1 className="font-display-soc text-xl font-bold tracking-tight">Shift Handoff</h1>
        </div>
        <div className="flex gap-2 no-print">
          <Button size="sm" onClick={copyAll} aria-live="polite">
            <CopyIcon className="h-4 w-4" />
            {copied ? "copied" : "copy"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <PrinterIcon className="h-4 w-4" />
            print
          </Button>
        </div>
      </div>
      <ShiftSummaryPanel />
      {q.isLoading ? (
        <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Loading handoff">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="soc-card mt-4 p-5" role="alert">
          <p className="text-sm font-medium text-[var(--soc-sev-p1)]">Handoff failed to load.</p>
          <p className="mt-1 text-sm text-[var(--soc-ink-dim)]">The briefing generator may be offline — retry the fetch.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
            Retry handoff
          </Button>
        </div>
      ) : sections.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {sections.map((s, i) => (
            <SectionCard key={s.title} section={s} index={i} />
          ))}
        </div>
      ) : (
        <pre className="soc-card mt-4 whitespace-pre-wrap p-4 text-sm leading-relaxed text-[var(--soc-ink-dim)]">
          {q.data}
        </pre>
      )}
      <footer className="font-mono-soc mt-4 text-[11px] uppercase tracking-[0.12em] text-[var(--soc-ink-faint)]">
        Synthetic dataset · Estimate-labeled MITRE · Human-in-the-loop · All-free stack: Bun +
        Vercel + Render + Koyeb + Neon + Upstash · torch/jeff local-only
      </footer>
    </main>
  );
}
