'use client';

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useIncidents } from "@/hooks/useSoc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SEVS = ["P1", "P2", "P3", "P4"] as const;
const STATUSES = ["open", "acknowledged", "escalated", "false_positive"] as const;

type Row = Record<string, unknown>;

function railFor(sev: string) {
  if (sev === "P1") return "soc-rail-p1";
  if (sev === "P2") return "soc-rail-p2";
  if (sev === "P3") return "soc-rail-p3";
  if (sev === "P4") return "soc-rail-p4";
  return "";
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[var(--soc-radius)] border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-[var(--soc-accent)] bg-[var(--soc-surface-2)] text-[var(--soc-accent)]"
          : "border-[var(--soc-border)] text-[var(--soc-ink-dim)] hover:border-[var(--soc-border-strong)]"
      }`}
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
      <h1 className="text-xl font-semibold">Incidents</h1>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip active={!selSev} onClick={() => setParam("severity", null)}>
          All
        </Chip>
        {SEVS.map((s) => (
          <Chip key={s} active={selSev === s} onClick={() => setParam("severity", selSev === s ? null : s)}>
            {s}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip active={!selStatus} onClick={() => setParam("status", null)}>
          All
        </Chip>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            active={selStatus === s}
            onClick={() => setParam("status", selStatus === s ? null : s)}
          >
            {s}
          </Chip>
        ))}
      </div>
      {selTech && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--soc-ink-dim)]">
          <span>
            technique <span className="font-mono-soc text-[var(--soc-accent)]">{selTech}</span>
          </span>
          <button className="text-[var(--soc-accent)]" onClick={() => setParam("technique", null)}>
            clear
          </button>
        </div>
      )}
      {q.isLoading ? (
        <Skeleton className="mt-4 h-64" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--soc-ink-dim)]">No incidents match these filters.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-[var(--soc-ink-faint)]">
            {total} incident{total === 1 ? "" : "s"} · page {pageNum} of {pageCount}
          </p>
          <table className="soc mt-2 hidden w-full md:table">
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
                return (
                  <tr key={String(r.id)}>
                    <td className="font-mono-soc">
                      <Link
                        href={`/incidents/${String(r.id)}`}
                        className="text-[var(--soc-accent)]"
                      >
                        {String(r.id)}
                      </Link>
                    </td>
                    <td>
                      <Badge
                        tone={(String(r.severity ?? "P4")).toLowerCase() as "p1" | "p2" | "p3" | "p4"}
                      >
                        {String(r.severity)}
                      </Badge>
                    </td>
                    <td className="font-mono-soc">{String(r.asset_id)}</td>
                    <td>{String(r.risk_score)}</td>
                    <td className="font-mono-soc">{String(r.primary_technique || "—")}</td>
                    <td>{String(r.status)}</td>
                    <td>{jev ? `${String(jev.disposition)} (${String(jev.source)})` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            {rows.map((r) => {
              const jev = (r.ai_brief as Record<string, unknown> | undefined)?.jev as
                | { disposition?: string; source?: string }
                | null
                | undefined;
              return (
                <Link
                  key={String(r.id)}
                  href={`/incidents/${String(r.id)}`}
                  className={`soc-card block p-3 ${railFor(String(r.severity))}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-soc text-sm text-[var(--soc-ink)]">
                      {String(r.id)}
                    </span>
                    <Badge
                      tone={(String(r.severity ?? "P4")).toLowerCase() as "p1" | "p2" | "p3" | "p4"}
                    >
                      {String(r.severity)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--soc-ink-dim)]">
                    <span className="font-mono-soc">{String(r.asset_id)}</span>
                    <span>
                      risk <span className="font-mono-soc">{String(r.risk_score)}</span>
                    </span>
                    <span className="font-mono-soc text-[var(--soc-accent)]">
                      {String(r.primary_technique || "—")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--soc-ink-dim)]">
                    {String(r.status)} ·{" "}
                    {jev ? `${String(jev.disposition)} (${String(jev.source)})` : "untriaged"}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" disabled={pageNum <= 1} onClick={() => setPage(pageNum - 1)}>
              prev
            </Button>
            <Button
              variant="outline"
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
