/** Pure mapper: server graph -> render model. No WebGL, unit-tested. */
export interface GraphNode {
  id: string;
  kind: "ip" | "user" | "host" | "technique";
  label: string;
  risk: number;
  choke: boolean;
  color: string;
  position: [number, number, number];
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  color: string;
}

const NODE_COLORS: Record<GraphNode["kind"], string> = {
  ip: "#06b6d4",
  user: "#f59e0b",
  host: "#10b981",
  technique: "#f97316",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  acknowledged: "#f59e0b",
  escalated: "#ef4444",
  false_positive: "#64748b",
};

export function buildGraphModel(
  graph: { nodes: Array<{ id: string; kind: string; label: string; risk?: number; choke?: boolean }>; edges: Array<{ from: string; to: string; label: string }> },
  status = "open",
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const edgeColor = STATUS_COLORS[status] ?? "#ef4444";
  const nodes: GraphNode[] = graph.nodes.map((n, i) => {
    const kind = (["ip", "user", "host", "technique"].includes(n.kind)
      ? n.kind : "host") as GraphNode["kind"];
    const choke = n.choke === true;
    const angle = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2;
    const ring = kind === "technique" ? 3.4 : 2.2;
    return {
      id: n.id,
      kind,
      label: n.label,
      risk: n.risk ?? 0,
      choke,
      color: choke ? "#ef4444" : NODE_COLORS[kind],
      position: [Math.cos(angle) * ring, ((i * 37) % 20) / 10 - 1, Math.sin(angle) * ring],
    };
  });
  const edges: GraphEdge[] = graph.edges.map((e) => ({
    from: e.from,
    to: e.to,
    label: e.label,
    color: edgeColor,
  }));
  return { nodes, edges };
}
