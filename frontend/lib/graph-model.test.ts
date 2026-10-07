import { describe, expect, it } from "vitest";
import { buildGraphModel } from "@/lib/graph-model";

const FIXTURE = {
  nodes: [
    { id: "ip:1.1.1.1", kind: "ip", label: "1.1.1.1", risk: 90 },
    { id: "user:u", kind: "user", label: "u", risk: 80 },
    { id: "host:h", kind: "host", label: "h", risk: 85 },
    { id: "tech:T1003.001", kind: "technique", label: "T1003.001", risk: 95, choke: true },
  ],
  edges: [
    { from: "ip:1.1.1.1", to: "user:u", label: "auth-as" },
    { from: "user:u", to: "host:h", label: "on" },
    { from: "host:h", to: "tech:T1003.001", label: "exhibits" },
  ],
};

describe("buildGraphModel", () => {
  it("maps nodes/edges with choke flag and colors", () => {
    const m = buildGraphModel(FIXTURE, "open");
    expect(m.nodes).toHaveLength(4);
    expect(m.edges).toHaveLength(3);
    const choke = m.nodes.find((n) => n.choke);
    expect(choke?.color).toBe("#ef4444");
    expect(m.nodes.find((n) => n.kind === "ip")?.color).toBe("#06b6d4");
    expect(m.nodes.find((n) => n.kind === "user")?.color).toBe("#f59e0b");
    expect(m.edges[0].color).toBe("#ef4444");
  });

  it("uses mitigated edge color for false_positive", () => {
    const m = buildGraphModel(FIXTURE, "false_positive");
    expect(m.edges[0].color).toBe("#64748b");
  });
});
