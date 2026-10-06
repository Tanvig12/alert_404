'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

function SectionCard({ section }: { section: Section }) {
  return (
    <section className="soc-card p-4">
      <h2 className="text-sm font-semibold text-[var(--soc-ink)]">{section.title}</h2>
      {section.rows.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {section.rows.map((r, i) => (
            <li key={i} className="text-sm text-[var(--soc-ink-dim)]">
              {r}
            </li>
          ))}
        </ul>
      )}
      {section.checks.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {section.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[var(--soc-ink)]">
              <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-[var(--soc-border-strong)]" />
              {c}
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
      <h1 className="text-xl font-semibold">Shift Handoff</h1>
      <div className="mt-2 flex gap-2 no-print">
        <Button
          variant="outline"
          onClick={() => {
            if (q.data) {
              navigator.clipboard.writeText(q.data);
              setCopied(true);
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          print
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="mt-4 h-96" />
      ) : sections.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {sections.map((s) => (
            <SectionCard key={s.title} section={s} />
          ))}
        </div>
      ) : (
        <pre className="soc-card mt-4 whitespace-pre-wrap p-4 text-sm text-[var(--soc-ink-dim)]">
          {q.data}
        </pre>
      )}
      <footer className="mt-4 text-xs text-[var(--soc-ink-faint)]">
        Synthetic dataset · Estimate-labeled MTTT · Human-in-the-loop · All-free stack: Bun +
        Vercel + Render + Koyeb + Neon + Upstash · torch/jeff local-only
      </footer>
    </main>
  );
}
