'use client';

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useIncidents } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityIcon, CrosshairIcon } from "@/components/icons";

const SEVS = ["P1", "P2", "P3", "P4"] as const;
const STATUSES = ["open", "acknowledged", "escalated", "false_positive"] as const;

type Row = Record<string, unknown>;

const SEV_RAIL: Record<string, string> = {
  P1: "soc-rail-p1",
  P2: "soc-rail-p2",
  P3: "soc-rail-p3",
  P4: "soc-rail-p4",
};

function Chip({
  active,
  onClick,
  children,
  tone = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[32px] rounded-[var(--radius-control)] border px-2.5 py-1 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        active
          ? "border-[var(--soc-accent)] bg-[var(--soc-accent)]/15 text-[var(--soc-accent)] shadow-[0_0_10px_var(--soc-accent-glow)]"
          : "border-[var(--soc-border)] bg-[var(--soc-surface)] text-[var(--soc-ink-dim)] hover:border-[var(--soc-border-strong)] hover:text-[var(--soc-ink)]"
      } ${tone ? "font-mono-soc" : ""}`}
    >
      {children}
    </button>
  );
}

function Table() {
  const sp = useSearchParams();
  const router = useRouter();
  const params: Record<string, string> = {};
  for (const k of ["severity", "status", "technique", "page"]) {
    const v = sp.get(k);
    if (v) params[k] = v;
  }
  const q = useIncidents(params);
  const rows = (q.data?.incidents ?? []) as Row[];
  const total = (q.data?.total ?? rows.length) as number;
  const pageNum = Number(sp.get("page") ?? "1") || 1;
  const pageCount = Math.max(1, Math.ceil(total / 50));

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const s = next.toString();
    router.replace(s ? `?${s}` : "?");
  }

  function setPage(p: number) {
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const s = next.toString();
    router.replace(s ? `?${s}` : "?");
  }

  const selSev = sp.get("severity");
  const selStatus = sp.get("status");
  const selTech = sp.get("technique");

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono-soc flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--soc-accent)]">
            <CrosshairIcon className="h-3.5 w-3.5" /> triage grid
          </p>
          <h1 className="font-display-soc text-xl font-bold tracking-tight">Incidents</h1>
        </div>
        <p className="font-mono-soc text-[11px] tracking-wide text-[var(--soc-ink-faint)]" aria-live="polite">
          {q.isLoading ? "scanning queue…" : `${total} incident${total === 1 ? "" : "s"} · page ${pageNum} of ${pageCount}`}
        </p>
      </div>

      <div className="soc-card mt-3 flex flex-col gap-2.5 p-3" role="group" aria-label="Incident filters">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono-soc mr-1 text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
            severity
          </span>
          <Chip active={!selSev} onClick={() => setParam("severity", null)}>
            All
          </Chip>
          {SEVS.map((s) => (
            <Chip key={s} tone active={selSev === s} onClick={() => setParam("severity", selSev === s ? null : s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono-soc mr-1 text-[11px] uppercase tracking-[0.14em] text-[var(--soc-ink-faint)]">
            status
          </span>
          <Chip active={!selStatus} onClick={() => setParam("status", null)}>
            All
          </Chip>
          {STATUSES.map((s) => (
            <Chip
              key={s}
              active={selStatus === s}
              onClick={() => setParam("status", selStatus === s ? null : s)}
            >
              {s.replace("_", " ")}
            </Chip>
          ))}
        </div>
      </div>
      {selTech && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--soc-ink-dim)]">
          <span>
            technique <span className="font-mono-soc font-semibold text-[var(--soc-cyan)]">{selTech}</span>
          </span>
          <button type="button" className="text-[var(--soc-accent)] underline underline-offset-2" onClick={() => setParam("technique", null)}>
            clear
          </button>
        </div>
      )}
      {q.isLoading ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true" aria-label="Loading incidents">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[52px]" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="soc-card mt-4 p-5" role="alert">
          <p className="text-sm font-medium text-[var(--soc-sev-p1)]">Incident queue failed to load.</p>
          <p className="mt-1 text-sm text-[var(--soc-ink-dim)]">The correlator may be restarting — retry the fetch.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
            Retry queue
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="soc-card mt-4 p-5" role="status">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-inset)] border border-[var(--soc-border)] bg-[var(--soc-surface-2)] text-[var(--soc-ink-faint)]">
            <ActivityIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--soc-ink)]">No incidents match these filters</p>
          <p className="mt-1 text-sm text-[var(--soc-ink-dim)]">Widen the severity or status scope to keep triaging.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              const next = new URLSearchParams();
              router.replace("?");
              void next;
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="soc-card mt-3 hidden overflow-hidden md:block">
            <table className="soc min-w-[640px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Asset</th>
                  <th>Risk</th>
                  <th>Technique</th>
                  <th>Status</th>
                  <th>Triage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const jev = (r.ai_brief as Record<string, unknown> | undefined)?.jev as
                    | { disposition?: string; source?: string }
                    | null
                    | undefined;
                  const sev = String(r.severity ?? "P4");
                  return (
                    <tr key={String(r.id)} className="transition-[background-color] duration-150 hover:bg-[var(--soc-surface-2)]">
                      <td className="font-mono-soc font-semibold">
                        <Link
                          href={`/incidents/${String(r.id)}`}
                          className="text-[var(--soc-accent)] hover:underline"
                        >
                          {String(r.id)}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={sev.toLowerCase() as "p1" | "p2" | "p3" | "p4"}>
                          {sev}
                        </Badge>
                      </td>
                      <td className="font-mono-soc">{String(r.asset_id)}</td>
                      <td className="font-mono-soc tabular-nums">{String(r.risk_score)}</td>
                      <td className="font-mono-soc text-[var(--soc-cyan)]">{String(r.primary_technique || "—")}</td>
                      <td className="text-[var(--soc-ink-dim)]">{String(r.status)}</td>
                      <td className="font-mono-soc text-[var(--soc-ink-dim)]">{jev ? `${String(jev.disposition)} (${String(jev.source)})` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            {rows.map((r) => {
              const jev = (r.ai_brief as Record<string, unknown> | undefined)?.jev as
                | { disposition?: string; source?: string }
                | null
                | undefined;
              const sev = String(r.severity ?? "P4");
              return (
                <Link
                  key={String(r.id)}
                  href={`/incidents/${String(r.id)}`}
                  className={`soc-card block p-3 ${SEV_RAIL[sev] ?? ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-soc text-sm font-semibold text-[var(--soc-ink)]">
                      {String(r.id)}
                    </span>
                    <Badge tone={sev.toLowerCase() as "p1" | "p2" | "p3" | "p4"}>
                      {sev}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--soc-ink-dim)]">
                    <span className="font-mono-soc">{String(r.asset_id)}</span>
                    <span>
                      risk <span className="font-mono-soc tabular-nums text-[var(--soc-ink)]">{String(r.risk_score)}</span>
                    </span>
                    <span className="font-mono-soc text-[var(--soc-cyan)]">
                      {String(r.primary_technique || "—")}
                    </span>
                  </div>
                  <div className="font-mono-soc mt-1 text-[11px] text-[var(--soc-ink-faint)]">
                    {String(r.status)} ·{" "}
                    {jev ? `${String(jev.disposition)} (${String(jev.source)})` : "untriaged"}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pageNum <= 1} onClick={() => setPage(pageNum - 1)}>
              prev
            </Button>
            <span className="font-mono-soc text-[11px] text-[var(--soc-ink-faint)]">
              {pageNum} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pageNum >= pageCount}
              onClick={() => setPage(pageNum + 1)}
            >
              next
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense>
      <Table />
    </Suspense>
  );
}
