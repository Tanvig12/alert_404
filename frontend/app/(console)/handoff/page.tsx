'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon, CopyIcon, DocIcon, PrinterIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

async function fetchHandoff(): Promise<string> {
  const r = await fetch("/api/soc/handoff.md");
  if (!r.ok) throw new Error(`handoff: ${r.status}`);
  return r.text();
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

export default function HandoffPage() {
  const q = useQuery({ queryKey: ["handoff"], queryFn: fetchHandoff });
  const [copied, setCopied] = useState(false);
  const sections = q.data ? parseSections(q.data) : [];

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
          <Button
            size="sm"
            onClick={() => {
              if (q.data) {
                navigator.clipboard.writeText(q.data);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }
            }}
            aria-live="polite"
          >
            <CopyIcon className="h-4 w-4" />
            {copied ? "copied" : "copy"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <PrinterIcon className="h-4 w-4" />
            print
          </Button>
        </div>
      </div>
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
