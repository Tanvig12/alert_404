import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttackGraph2D } from "./attack-graph-2d";

const FIXTURE = {
  nodes: [
    { id: "ip:1", kind: "ip", label: "10.0.0.1-long-label", risk: 80 },
    { id: "host:h", kind: "host", label: "workstation-7", risk: 40, choke: true },
  ],
  edges: [{ from: "ip:1", to: "host:h", label: "connects" }],
};

describe("AttackGraph2D", () => {
  it("renders nodes, edges, and choke ring", () => {
    const { container } = render(<AttackGraph2D graph={FIXTURE} />);
    expect(container.querySelector('[data-testid="graph-2d"]')).not.toBeNull();
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll("line").length).toBe(1);
  });
  it("click node shows label panel", () => {
    const { container } = render(<AttackGraph2D graph={FIXTURE} />);
    const node = container.querySelector("circle[fill]") as SVGElement;
    fireEvent.click(node);
    expect(screen.getAllByText("10.0.0.1-long-label").length).toBeGreaterThan(0);
  });

  it("renders empty-state when graph missing", () => {
    render(<AttackGraph2D graph={null} />);
    expect(screen.getByText(/No graph data/)).toBeDefined();
  });
});
