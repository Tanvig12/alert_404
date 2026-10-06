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
    <div>
      <div className="mb-2 flex gap-1" role="group" aria-label="Graph view">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-[var(--soc-radius)] px-3 py-1 text-xs font-medium ${
              mode === m
                ? "bg-[var(--soc-accent)] text-[var(--soc-accent-ink)]"
                : "border border-[var(--soc-border)] text-[var(--soc-ink-dim)]"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {mode === "2d" ? (
        <AttackGraph2D graph={graph} status={status} height={height} />
      ) : (
        <AttackGraph3D graph={graph} status={status} height={height} />
      )}
    </div>
  );
}

export default GraphPanel;
