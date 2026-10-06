import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useFrame: () => {},
}));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null }));
vi.mock("three", () => ({
  Vector3: class {
    x = 0;
    y = 0;
    z = 0;
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  },
}));

import { AttackGraph3D } from "./attack-graph-3d";

describe("AttackGraph3D fallback", () => {
  it("renders scene nodes when WebGL modules mocked", () => {
    const { container } = render(
      <AttackGraph3D
        graph={{
          nodes: [{ id: "host:h", kind: "host", label: "h", risk: 10 }],
          edges: [],
        }}
      />,
    );
    expect(container.querySelector("group")).not.toBeNull();
  });

  it("renders empty-state when graph missing", () => {
    render(<AttackGraph3D graph={null} />);
    expect(screen.getByText(/No graph data/)).toBeDefined();
  });
});
