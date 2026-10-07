'use client';

import dynamic from "next/dynamic";
import { useState } from "react";
import { AttackGraph2D } from "@/components/attack-graph-2d";
import type { ServerGraph } from "@/components/attack-graph-3d";

const AttackGraph3D = dynamic(() => import("@/components/attack-graph-3d"), { ssr: false });

export function GraphPanel({
  graph,
  status = "open",
  height = 420,
}: {
  graph: ServerGraph | null | undefined;
  status?: string;
  height?: number;
}) {
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  return (
    <div data-testid="graph-panel">
      <div className="mb-2 flex items-center justify-between gap-2" role="group" aria-label="Graph view">
        <p className="font-mono-soc text-[11px] uppercase tracking-[0.16em] text-[var(--soc-ink-faint)]">
          topology · {status}
        </p>
        <div className="flex gap-1 rounded-[var(--radius-control)] border border-[var(--soc-border)] bg-[var(--soc-surface-2)] p-0.5">
          {(["2d", "3d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[30px] min-w-[44px] rounded-[var(--radius-tight)] px-3 py-1 text-xs font-semibold transition-[color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                mode === m
                  ? "bg-[var(--soc-accent)] text-[var(--soc-accent-ink)] shadow-[0_0_10px_var(--soc-accent-glow)]"
                  : "text-[var(--soc-ink-dim)] hover:text-[var(--soc-ink)]"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-inset)] border border-[var(--soc-border-subtle)] bg-[var(--soc-bg)]">
        {mode === "2d" ? (
          <AttackGraph2D graph={graph} status={status} height={height} />
        ) : (
          <AttackGraph3D graph={graph} status={status} height={height} />
        )}
      </div>
    </div>
  );
}

export default GraphPanel;
