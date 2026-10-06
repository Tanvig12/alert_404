'use client';

import Link from "next/link";
import dynamic from "next/dynamic";
import { useDashboard, useEvaluation } from "@/hooks/useSoc";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowIcon, DocIcon, GridIcon, RadarIcon, ShieldIcon } from "@/components/icons";

const LandingHero3D = dynamic(() => import("@/components/landing-hero-3d"), { ssr: false });

const STATIONS = [
  {
    icon: RadarIcon,
    title: "Overview",
    blurb: "Queue, KPIs, and the top P1 attack graph at a glance.",
    href: "/console",
  },
  {
    icon: ShieldIcon,
    title: "Incidents",
    blurb: "Triage 120 correlated incidents with AI briefs.",
    href: "/incidents",
  },
  {
    icon: GridIcon,
    title: "Matrix",
    blurb: "MITRE coverage across techniques and severities.",
    href: "/matrix",
  },
  {
    icon: DocIcon,
    title: "Handoff",
    blurb: "Shift-ready notes with estimate-labeled decisions.",
    href: "/handoff",
  },
];

const PIPELINE = [
  "Ingest 3,000 alerts",
  "Correlate 120 incidents",
  "Brief every P1",
  "Analyst decides",
];

function StatStrip() {
  const dash = useDashboard();
  const evaluation = useEvaluation();
  const d = (dash.data ?? {}) as { total_alerts?: unknown; total_incidents?: unknown; critical?: unknown };
  const ev = (evaluation.data ?? {}) as { f1?: unknown };
  const stats: Array<[string, unknown]> = [
    ["alerts", d.total_alerts],
    ["incidents", d.total_incidents],
    ["P1 open", d.critical],
    ["F1", ev.f1],
  ];
  if (dash.isLoading && !dash.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label]) => (
          <div key={label} className="soc-card p-3">
            <Skeleton className="h-7 w-16" />
            <p className="mt-1 text-xs text-[var(--soc-ink-faint)]">{label}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="soc-card p-3">
          <p className="text-2xl font-semibold text-[var(--soc-ink)]">{String(value ?? "—")}</p>
          <p className="mt-1 text-xs text-[var(--soc-ink-faint)]">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function LandingClient() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-[var(--soc-border)] bg-[var(--soc-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <p className="text-base font-semibold text-[var(--soc-ink)]">
            <span className="text-[var(--soc-accent)]">◆</span> SOC Sentinel
          </p>
          <Link
            href="/console"
            className="rounded-[var(--soc-radius)] bg-[var(--soc-accent)] px-3 py-1.5 text-sm font-medium text-[var(--soc-accent-ink)]"
          >
            Open console
          </Link>
        </div>
      </div>

      <section className="soc-reveal relative overflow-hidden">
        <LandingHero3D />
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: "color-mix(in srgb, var(--soc-bg) 55%, transparent)" }}
        />
        <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-4 py-16">
          <p className="soc-badge-accent soc-badge w-fit">AI-assisted SOC · rules + OpenRouter</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold text-[var(--soc-ink)] md:text-6xl">
            See the attack before it lands.
          </h1>
          <p className="mt-4 max-w-xl text-base text-[var(--soc-ink-dim)]">
            SOC Sentinel turns thousands of noisy alerts into a ranked incident queue with attack
            graphs and analyst-ready briefs — you make the call.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/console"
              className="rounded-[var(--soc-radius)] bg-[var(--soc-accent)] px-4 py-2 text-sm font-medium text-[var(--soc-accent-ink)]"
            >
              Open live console
            </Link>
            <Link
              href="#how"
              className="rounded-[var(--soc-radius)] border border-[var(--soc-border-strong)] px-4 py-2 text-sm text-[var(--soc-ink)]"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="soc-reveal mt-8" aria-label="Live stats">
          <StatStrip />
        </section>

        <section id="stations" className="soc-reveal mt-12" aria-label="Stations">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">Four stations, one queue</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {STATIONS.map((s) => (
              <Link key={s.href} href={s.href} className="soc-card block p-4">
                <s.icon className="h-6 w-6 text-[var(--soc-accent)]" />
                <p className="mt-2 text-base font-medium text-[var(--soc-ink)]">{s.title}</p>
                <p className="mt-1 text-sm text-[var(--soc-ink-dim)]">{s.blurb}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--soc-accent)]">
                  Open <ArrowIcon className="h-4 w-4" />
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section id="how" className="soc-reveal mt-12" aria-label="How it works">
          <h2 className="text-sm font-medium text-[var(--soc-ink-dim)]">How it works</h2>
          <ol className="mt-3 grid gap-3 md:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <li key={step} className="soc-card p-4">
                <p className="font-mono-soc text-xs text-[var(--soc-accent)]">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 text-sm font-medium text-[var(--soc-ink)]">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="soc-reveal mt-12 border-t border-[var(--soc-border)] pt-4">
          <p className="text-xs text-[var(--soc-ink-faint)]">
            Synthetic dataset · Estimate-labeled MTTT · Human-in-the-loop
          </p>
        </footer>
      </main>
    </div>
  );
}
