import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="graph-3d-stub" />,
}));

import { GraphPanel } from "./graph-panel";

const FIXTURE = {
  nodes: [{ id: "host:h", kind: "host", label: "workstation-7", risk: 40 }],
  edges: [],
};

describe("GraphPanel", () => {
  it("defaults to 3D and toggles to 2D and back", () => {
    render(<GraphPanel graph={FIXTURE} />);
    expect(screen.getByTestId("graph-3d-stub")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(screen.getByTestId("graph-2d")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "3D" }));
    expect(screen.getByTestId("graph-3d-stub")).toBeDefined();
  });
});
