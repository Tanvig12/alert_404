'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard, useEvaluation } from "@/hooks/useSoc";

const NAV = [
  { href: "/console", label: "Overview" },
  { href: "/incidents", label: "Incidents" },
  { href: "/matrix", label: "Matrix" },
  { href: "/handoff", label: "Handoff" },
];

function QueueHealth() {
  const dash = useDashboard();
  const d = (dash.data ?? {}) as { critical?: unknown; high_risk?: unknown };
  if (dash.isLoading) return <p className="text-xs text-[var(--soc-ink-faint)]">queue …</p>;
  return (
    <p className="text-xs text-[var(--soc-ink-dim)]">
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
    <p className="text-xs text-[var(--soc-ink-dim)]">
      brain:{ok ? <span className="text-[var(--soc-ok)]">ok</span> : <span className="text-[var(--soc-sev-p2)]">{brain}</span>}
    </p>
  );
}

function NavLinks({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={horizontal ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-1"}>
      {NAV.map((n) => {
        const active = n.href === "/console" ? pathname === "/console" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={
              horizontal
                ? `whitespace-nowrap rounded-[var(--soc-radius)] px-3 py-1.5 text-sm ${active ? "bg-[var(--soc-surface-2)] text-[var(--soc-accent)]" : "text-[var(--soc-ink-dim)]"}`
                : `rounded-[var(--soc-radius)] px-3 py-1.5 text-sm ${active ? "bg-[var(--soc-surface-2)] text-[var(--soc-accent)]" : "text-[var(--soc-ink-dim)] hover:bg-[var(--soc-surface)]"}`
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r border-[var(--soc-border)] bg-[var(--soc-surface)] p-4 lg:flex">
        <p className="text-base font-semibold text-[var(--soc-ink)]">
          <span className="text-[var(--soc-accent)]">◆</span> SOC Sentinel
        </p>
        <NavLinks />
        <div className="mt-auto flex flex-col gap-1 border-t border-[var(--soc-border)] pt-3">
          <QueueHealth />
          <BrainBadge />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b border-[var(--soc-border)] bg-[var(--soc-surface)] px-4 py-3 lg:hidden">
          <p className="text-base font-semibold text-[var(--soc-ink)]">
            <span className="text-[var(--soc-accent)]">◆</span> SOC Sentinel
          </p>
          <div className="mt-2">
            <NavLinks horizontal />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
