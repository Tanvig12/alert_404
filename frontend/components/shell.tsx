'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard, useEvaluation } from "@/hooks/useSoc";
import { CrosshairIcon, DocIcon, GridIcon, RadarIcon } from "@/components/icons";

const NAV = [
  { href: "/console", label: "Overview", icon: RadarIcon },
  { href: "/incidents", label: "Incidents", icon: CrosshairIcon },
  { href: "/matrix", label: "Matrix", icon: GridIcon },
  { href: "/handoff", label: "Handoff", icon: DocIcon },
];

function QueueHealth() {
  const dash = useDashboard();
  const d = (dash.data ?? {}) as { critical?: unknown; high_risk?: unknown };
  if (dash.isLoading)
    return <p className="font-mono-soc text-[11px] tracking-wide text-[var(--soc-ink-faint)]">queue …</p>;
  return (
    <p className="font-mono-soc text-[11px] tracking-wide text-[var(--soc-ink-dim)]">
      queue open/{String(d.high_risk ?? "—")} escalated/{String(d.critical ?? "—")}
    </p>
  );
}

function BrainBadge() {
  const evaluation = useEvaluation();
  const dash = useDashboard();
  const ev = (evaluation.data ?? {}) as { brain?: unknown };
  const d = (dash.data ?? {}) as { brain?: unknown };
  const brain = String(ev.brain ?? d.brain ?? "—");
  const ok = brain === "ok";
  return (
    <p className="font-mono-soc text-[11px] tracking-wide text-[var(--soc-ink-dim)]">
      brain:
      {ok ? (
        <span className="ml-1 inline-flex items-center gap-1 text-[var(--soc-ok)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--soc-ok)]" aria-hidden="true" />
          ok
        </span>
      ) : (
        <span className="ml-1 text-[var(--soc-sev-p2)]">{brain}</span>
      )}
    </p>
  );
}

function NavLinks({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Console" className={horizontal ? "flex gap-1" : "flex flex-col gap-1"}>
      {NAV.map((n) => {
        const active = n.href === "/console" ? pathname === "/console" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              horizontal
                ? `flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-2 py-1.5 text-[11px] font-medium transition-[color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${active ? "bg-[var(--soc-surface-2)] text-[var(--soc-accent)]" : "text-[var(--soc-ink-dim)]"}`
                : `flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${active ? "bg-[var(--soc-surface-2)] text-[var(--soc-accent)] shadow-[inset_0_1px_0_var(--soc-border-specular)]" : "text-[var(--soc-ink-dim)] hover:bg-[var(--soc-surface-2)] hover:text-[var(--soc-ink)]"}`
            }
          >
            <Icon className={horizontal ? "h-5 w-5" : "h-4 w-4"} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-5 border-r border-[var(--soc-border)] bg-[var(--soc-surface)] p-4 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-1" aria-label="SOC Sentinel home">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-accent)]/40 bg-[var(--soc-accent)]/10 text-[var(--soc-accent)]">
            <CrosshairIcon className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="font-display-soc block text-[15px] font-bold tracking-tight text-[var(--soc-ink)]">
              SOC Sentinel
            </span>
            <span className="font-mono-soc block text-[10px] uppercase tracking-[0.18em] text-[var(--soc-ink-faint)]">
              ops console
            </span>
          </span>
        </Link>
        <NavLinks />
        <div className="mt-auto flex flex-col gap-1.5 rounded-[var(--radius-inset)] border border-[var(--soc-border-subtle)] bg-[var(--soc-surface-2)] p-3">
          <p className="font-mono-soc text-[10px] uppercase tracking-[0.18em] text-[var(--soc-ink-faint)]">
            live status
          </p>
          <QueueHealth />
          <BrainBadge />
        </div>
      </aside>
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        <header className="flex items-center gap-2 border-b border-[var(--soc-border)] bg-[var(--soc-surface)] px-4 py-3 lg:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-accent)]/40 bg-[var(--soc-accent)]/10 text-[var(--soc-accent)]">
            <CrosshairIcon className="h-4 w-4" />
          </span>
          <p className="font-display-soc text-base font-bold tracking-tight text-[var(--soc-ink)]">
            SOC Sentinel
          </p>
        </header>
        {children}
        <nav
          aria-label="Console"
          className="fixed inset-x-2 bottom-2 z-50 rounded-[16px] border border-white/10 bg-[rgba(13,18,21,0.82)] p-1.5 backdrop-blur-[16px] lg:hidden"
        >
          <NavLinks horizontal />
        </nav>
      </div>
    </div>
  );
}
