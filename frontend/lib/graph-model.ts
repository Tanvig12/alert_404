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
  ip: "#6FC3C9",
  user: "#D9A441",
  host: "#7FA88F",
  technique: "#E8C566",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#E5484D",
  acknowledged: "#E8933C",
  escalated: "#E5484D",
  false_positive: "#6E8B84",
};

export function buildGraphModel(
  graph: { nodes: Array<{ id: string; kind: string; label: string; risk?: number; choke?: boolean }>; edges: Array<{ from: string; to: string; label: string }> },
  status = "open",
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const edgeColor = STATUS_COLORS[status] ?? "#E5484D";
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
      color: choke ? "#E5484D" : NODE_COLORS[kind],
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
