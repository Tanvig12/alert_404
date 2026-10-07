'use client';

import Link from "next/link";
import dynamic from "next/dynamic";
import { useDashboard, useEvaluation, useNavigator } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActivityIcon,
  ArrowIcon,
  CrosshairIcon,
  CpuIcon,
  DocIcon,
  GridIcon,
  RadarIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
} from "@/components/icons";

const LandingHero3D = dynamic(() => import("@/components/landing-hero-3d"), { ssr: false });

const STATIONS = [
  {
    icon: RadarIcon,
    title: "Overview",
    blurb: "Queue, KPIs, and the top P1 attack graph at a glance.",
    href: "/console",
    meta: "5 live KPIs",
  },
  {
    icon: ShieldIcon,
    title: "Incidents",
    blurb: "Triage 120 correlated incidents with AI briefs.",
    href: "/incidents",
    meta: "P1 → P4 rails",
  },
  {
    icon: GridIcon,
    title: "Matrix",
    blurb: "MITRE coverage across techniques and severities.",
    href: "/matrix",
    meta: "tactic × severity",
  },
  {
    icon: DocIcon,
    title: "Handoff",
    blurb: "Shift-ready notes with estimate-labeled decisions.",
    href: "/handoff",
    meta: "copy + print",
  },
];

const PIPELINE = [
  { step: "Ingest 3,000 alerts", detail: "bursty synthetic feed, deduped at the edge" },
  { step: "Correlate 120 incidents", detail: "entity + tactic overlap, 24h merge windows" },
  { step: "Brief every P1", detail: "rules engine, OpenRouter upgrade path" },
  { step: "Analyst decides", detail: "escalate, acknowledge, or false-positive" },
];

function LiveStatus() {
  const dash = useDashboard();
  const d = (dash.data ?? {}) as { critical?: unknown; high_risk?: unknown; total_alerts?: unknown };
  if (dash.isLoading && !dash.data) {
    return (
      <span className="inline-flex items-center gap-2">
        <Skeleton className="h-5 w-40" />
      </span>
    );
  }
  return (
    <span className="font-mono-soc inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-wide text-[var(--soc-ink-dim)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--soc-ok)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--soc-ok)]" />
        </span>
        feed live
      </span>
      <span>{String(d.total_alerts ?? "—")} alerts</span>
      <span>{String(d.high_risk ?? "—")} high-risk</span>
      <span className="text-[var(--soc-sev-p1)]">{String(d.critical ?? "—")} critical</span>
    </span>
  );
}

function StatStrip() {
  const dash = useDashboard();
  const evaluation = useEvaluation();
  const d = (dash.data ?? {}) as { total_alerts?: unknown; total_incidents?: unknown; critical?: unknown };
  const ev = (evaluation.data ?? {}) as { f1?: unknown };
  const stats: Array<{ label: string; value: unknown; tint: string }> = [
    { label: "alerts ingested", value: d.total_alerts, tint: "text-[var(--soc-ink)]" },
    { label: "incidents formed", value: d.total_incidents, tint: "text-[var(--soc-ink)]" },
    { label: "P1 open", value: d.critical, tint: "text-[var(--soc-sev-p1)]" },
    { label: "detection F1", value: ev.f1, tint: "text-[var(--soc-ok)]" },
  ];
  if (dash.isLoading && !dash.data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading live stats">
        {stats.map((s) => (
          <div key={s.label} className="soc-card p-4">
            <Skeleton className="h-8 w-20" />
            <p className="font-mono-soc mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`soc-card soc-reveal p-4 ${i === 0 ? "lg:translate-y-2" : i === 3 ? "lg:-translate-y-2" : ""}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <p className={`font-mono-soc text-3xl font-bold tabular-nums ${s.tint}`}>
            {String(s.value ?? "—")}
          </p>
          <p className="font-mono-soc mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function TechniquePreview() {
  const nav = useNavigator();
  const techs = ((nav.data?.techniques ?? []) as Array<{ techniqueID: string; score: number }>).slice(0, 6);
  if (nav.isLoading) return <Skeleton className="h-24" />;
  if (techs.length === 0)
    return <p className="text-sm text-[var(--soc-ink-faint)]">Technique coverage appears after the first run.</p>;
  const max = Math.max(...techs.map((t) => t.score), 1);
  return (
    <ul className="flex flex-col gap-2">
      {techs.map((t) => (
        <li key={t.techniqueID} className="flex items-center gap-2 text-xs">
          <span className="font-mono-soc w-20 shrink-0 text-[var(--soc-cyan)]">{t.techniqueID}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-tight)] bg-[var(--soc-surface-3)]">
            <div
              className="h-full rounded-[var(--radius-tight)] bg-[var(--soc-cyan)]"
              style={{ width: `${Math.round((t.score / max) * 100)}%` }}
            />
          </div>
          <span className="font-mono-soc w-10 shrink-0 text-right tabular-nums text-[var(--soc-ink)]">
            {t.score.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function LandingClient() {
  return (
    <div className="min-h-[100dvh]">
      <div className="soc-sticky border-b border-[var(--soc-border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2" aria-label="SOC Sentinel home">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-accent)]/40 bg-[var(--soc-accent)]/10 text-[var(--soc-accent)]">
              <CrosshairIcon className="h-4 w-4" />
            </span>
            <span className="font-display-soc text-base font-bold tracking-tight text-[var(--soc-ink)]">
              SOC Sentinel
            </span>
          </Link>
          <LiveStatus />
          <Link
            href="/console"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--soc-accent)]/70 bg-[var(--soc-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--soc-accent-ink)] transition-[transform,box-shadow,filter] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_0_14px_var(--soc-accent-glow)] active:translate-y-0 active:scale-[0.98]"
          >
            Open console <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden border-b border-[var(--soc-border-subtle)]">
        <LandingHero3D />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: "color-mix(in srgb, var(--soc-bg) 62%, transparent)" }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-12 lg:items-end lg:py-20">
          <div className="lg:col-span-5">
            <p className="soc-badge soc-badge-accent w-fit">
              <SparklesIcon className="h-3.5 w-3.5" /> AI-assisted SOC · rules + OpenRouter
            </p>
            <h1 className="font-display-soc mt-4 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-[var(--soc-ink)] md:text-6xl">
              See the attack before it lands.
            </h1>
            <p className="mt-4 max-w-[65ch] text-[15px] leading-relaxed text-[var(--soc-ink-dim)]">
              SOC Sentinel turns thousands of noisy alerts into a ranked incident queue with attack
              graphs and analyst-ready briefs — you make the call.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/console"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--soc-accent)]/70 bg-[var(--soc-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--soc-accent-ink)] transition-[transform,box-shadow,filter] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_0_16px_var(--soc-accent-glow)] active:translate-y-0 active:scale-[0.98]"
              >
                Open live console <ArrowIcon className="h-4 w-4" />
              </Link>
              <Link
                href="#how"
                className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--soc-border-strong)] bg-[var(--soc-surface)] px-5 py-2.5 text-sm font-medium text-[var(--soc-ink)] transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--soc-ink-dim)] hover:bg-[var(--soc-surface-2)] active:translate-y-[1px]"
              >
                How it works
              </Link>
            </div>
            <dl className="font-mono-soc mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-3.5 w-3.5 text-[var(--soc-accent)]" />
                <dt className="sr-only">Pipeline</dt>
                <dd>3,000 alerts → 120 incidents</dd>
              </div>
              <div className="flex items-center gap-2">
                <CpuIcon className="h-3.5 w-3.5 text-[var(--soc-cyan)]" />
                <dt className="sr-only">Briefing</dt>
                <dd>every P1 briefed</dd>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-7">
            <div className="soc-card soc-reveal overflow-hidden p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="font-mono-soc text-[11px] uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
                  live attack topology · top P1
                </p>
                <Badge tone="p1" pulse>
                  streaming
                </Badge>
              </div>
              <div className="scanlines overflow-hidden rounded-[var(--radius-inset)] border border-[var(--soc-border-subtle)]">
                <GraphHero />
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="soc-reveal mt-8" aria-label="Live stats">
          <StatStrip />
        </section>

        <section id="stations" className="mt-12" aria-label="Stations">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono-soc text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
                four stations · one queue
              </p>
              <h2 className="font-display-soc mt-1 text-xl font-bold tracking-tight text-[var(--soc-ink)]">
                Pick up where the machines leave off
              </h2>
            </div>
            <Link
              href="/console"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--soc-accent)] hover:underline"
            >
              Enter the console <ArrowIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-12">
            {STATIONS.map((s, i) => (
              <Link
                key={s.href}
                href={s.href}
                className={`soc-card soc-reveal group block p-5 transition-[transform,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[2px] hover:border-[var(--soc-accent)]/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.45),0_0_12px_var(--soc-accent-glow)] ${i === 0 ? "lg:col-span-7" : i === 1 ? "lg:col-span-5" : i === 2 ? "lg:col-span-5" : "lg:col-span-7"}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-border)] bg-[var(--soc-surface-2)] text-[var(--soc-accent)]">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono-soc text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
                    {s.meta}
                  </span>
                </div>
                <p className="font-display-soc mt-3 text-lg font-bold tracking-tight text-[var(--soc-ink)]">
                  {s.title}
                </p>
                <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-[var(--soc-ink-dim)]">{s.blurb}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--soc-accent)]">
                  Open
                  <ArrowIcon className="h-4 w-4 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-3 lg:grid-cols-12" aria-label="Live telemetry">
          <div className="soc-card soc-reveal p-5 lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display-soc flex items-center gap-2 text-base font-bold tracking-tight text-[var(--soc-ink)]">
                <ActivityIcon className="h-4 w-4 text-[var(--soc-cyan)]" /> Live technique coverage
              </h2>
              <Link href="/matrix" className="inline-flex items-center gap-1 text-sm text-[var(--soc-accent)] hover:underline">
                Matrix <ArrowIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-3">
              <TechniquePreview />
            </div>
          </div>
          <div className="soc-card soc-reveal border-[var(--soc-accent)]/25 p-5 lg:col-span-5" style={{ animationDelay: "80ms" }}>
            <h2 className="font-display-soc flex items-center gap-2 text-base font-bold tracking-tight text-[var(--soc-ink)]">
              <TerminalIcon className="h-4 w-4 text-[var(--soc-accent)]" /> Shift handoff, automated
            </h2>
            <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[var(--soc-ink-dim)]">
              Every shift ends with a structured briefing: open P1s, escalations, detection gaps, and
              analyst sign-off — copyable as Markdown, printable for the war room.
            </p>
            <Link
              href="/handoff"
              className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--soc-border-strong)] bg-[var(--soc-surface-2)] px-3.5 py-1.5 text-sm font-medium text-[var(--soc-ink)] transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--soc-accent)] hover:text-[var(--soc-accent)] active:translate-y-[1px]"
            >
              Preview handoff <ArrowIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="how" className="mt-12" aria-label="How it works">
          <p className="font-mono-soc text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
            pipeline · ingest → decide
          </p>
          <h2 className="font-display-soc mt-1 text-xl font-bold tracking-tight text-[var(--soc-ink)]">
            From noise to a decision in four moves
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <li
                key={step.step}
                className={`soc-card soc-reveal p-4 ${i % 2 === 1 ? "lg:translate-y-3" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p className="font-mono-soc text-xs font-bold text-[var(--soc-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--soc-ink)]">{step.step}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--soc-ink-dim)]">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="soc-reveal mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--soc-border)] pt-4">
          <p className="font-mono-soc text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
            Synthetic dataset · Estimate-labeled MITRE · Human-in-the-loop
          </p>
          <Link href="/console" className="inline-flex items-center gap-1 text-sm text-[var(--soc-accent)] hover:underline">
            Open live console <ArrowIcon className="h-4 w-4" />
          </Link>
        </footer>
      </main>
    </div>
  );
}

function GraphHero() {
  return (
    <div className="relative h-[300px] md:h-[360px]" data-testid="graph-hero">
      <svg viewBox="0 0 640 320" className="h-full w-full" role="img" aria-label="Live attack topology preview">
        <defs>
          <radialGradient id="hero-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[
          [70, 60, 500, 110],
          [70, 60, 300, 220],
          [500, 110, 300, 220],
          [300, 220, 470, 260],
          [500, 110, 470, 260],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06b6d4" strokeOpacity="0.45" strokeWidth="1.5" />
        ))}
        {[
          { x: 70, y: 60, c: "#ef4444", l: "C2" },
          { x: 500, y: 110, c: "#f97316", l: "WS-04" },
          { x: 300, y: 220, c: "#f59e0b", l: "DB-01" },
          { x: 470, y: 260, c: "#06b6d4", l: "T1071" },
        ].map((n) => (
          <g key={n.l}>
            <circle cx={n.x} cy={n.y} r="26" fill="url(#hero-node)" opacity="0.35" />
            <circle cx={n.x} cy={n.y} r="7" fill={n.c} stroke="#070a0c" strokeWidth="2" />
            <text x={n.x} y={n.y - 16} textAnchor="middle" fill="#94a7a0" fontSize="11" fontFamily="'JetBrains Mono', ui-monospace, monospace">
              {n.l}
            </text>
          </g>
        ))}
      </svg>
      <p className="font-mono-soc absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.18em] text-[var(--soc-ink-faint)]">
        topology preview — full graph in console
      </p>
    </div>
  );
}
