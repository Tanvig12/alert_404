'use client';

import { useMemo, useState } from "react";
import { buildGraphModel } from "@/lib/graph-model";
import type { ServerGraph } from "@/components/attack-graph-3d";

const WIDTH = 400;
const PAD = 28;

function truncate(label: string, max = 14) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function AttackGraph2D({
  graph,
  status = "open",
  height = 420,
}: {
  graph: ServerGraph | null | undefined;
  status?: string;
  height?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(
    () => (graph && graph.nodes.length ? buildGraphModel(graph, status) : null),
    [graph, status],
  );

  if (!graph || !graph.nodes.length || !model) {
    return <p className="text-sm text-[var(--soc-ink-faint)]">No graph data for this incident.</p>;
  }

  const xs = model.nodes.map((n) => n.position[0]);
  const zs = model.nodes.map((n) => n.position[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const spanX = Math.max(maxX - minX, 0.001);
  const spanZ = Math.max(maxZ - minZ, 0.001);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (height - PAD * 2) / spanZ);
  const px = (x: number) => PAD + (x - minX) * scale + ((WIDTH - PAD * 2 - spanX * scale) / 2);
  const py = (z: number) => PAD + (z - minZ) * scale + ((height - PAD * 2 - spanZ * scale) / 2);
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const sel = graph.nodes.find((n) => n.id === selected);

  return (
    <div data-testid="graph-2d">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        style={{ height, width: "100%" }}
        role="img"
        aria-label="Attack graph"
      >
        {model.edges.map((e, i) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={px(a.position[0])}
              y1={py(a.position[2])}
              x2={px(b.position[0])}
              y2={py(b.position[2])}
              stroke={e.color}
              strokeOpacity={0.7}
              strokeWidth={1.5}
            />
          );
        })}
        {model.nodes.map((n) => {
          const cx = px(n.position[0]);
          const cy = py(n.position[2]);
          const isSel = selected === n.id;
          return (
            <g key={n.id}>
              {n.choke && (
                <circle cx={cx} cy={cy} r={15} fill="none" stroke="#E5484D" strokeWidth={1.5} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={n.choke ? 11 : 8}
                fill={n.color}
                stroke={isSel ? "var(--soc-ink)" : "none"}
                strokeWidth={isSel ? 2 : 0}
                onClick={() => setSelected(n.id)}
                style={{ cursor: "pointer" }}
              >
                <title>{n.label}</title>
              </circle>
              <text
                x={cx}
                y={cy + 24}
                textAnchor="middle"
                fill="var(--soc-ink-dim)"
                fontSize={10}
                fontFamily="var(--soc-font-mono)"
                onClick={() => setSelected(n.id)}
                style={{ cursor: "pointer" }}
              >
                {truncate(n.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 rounded border border-[var(--soc-border)] bg-[var(--soc-surface)] p-2 text-xs">
        {!sel ? (
          <p className="text-[var(--soc-ink-dim)]">Click a node for telemetry.</p>
        ) : (
          <div>
            <p className="font-mono-soc text-[var(--soc-ink)]">{sel.label}</p>
            <p className="text-[var(--soc-ink-dim)]">
              kind={sel.kind} risk={sel.risk ?? 0}
              {sel.choke ? " CHOKE" : ""}
            </p>
            <button className="mt-1 text-[var(--soc-accent)]" onClick={() => setSelected(null)}>
              clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttackGraph2D;
