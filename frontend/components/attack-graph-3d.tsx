'use client';

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ErrorBoundary } from "./error-boundary";
import { buildGraphModel } from "@/lib/graph-model";
import type { GraphNode } from "@/lib/graph-model";

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

export interface ServerGraph {
  nodes: Array<{ id: string; kind: string; label: string; risk?: number; choke?: boolean }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

function ChokePulse({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || reduced) return;
    const t = clock.getElapsedTime();
    const s = 1 + 0.25 * Math.sin(t * 3);
    m.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.45, 0.03, 8, 32]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
    </mesh>
  );
}

function Scene({
  graph,
  status,
  onSelect,
}: {
  graph: ServerGraph;
  status: string;
  onSelect: (id: string | null) => void;
}) {
  const model = useMemo(() => buildGraphModel(graph, status), [graph, status]);
  const byId = useMemo(() => {
    const table: Record<string, GraphNode> = {};
    for (const n of model.nodes) table[n.id] = n;
    return table;
  }, [model]);
  const shared = useMemo(() => new THREE.Vector3(), []);
  const [hover, setHover] = useState<string | null>(null);

  const positions = useMemo(() => {
    const pts: number[] = [];
    for (const e of model.edges) {
      const a = byId[e.from];
      const b = byId[e.to];
      if (!a || !b) continue;
      const [ax, ay, az] = a.position;
      const [bx, by, bz] = b.position;
      shared.set(ax, ay, az);
      pts.push(shared.x, shared.y, shared.z);
      shared.set(bx, by, bz);
      pts.push(shared.x, shared.y, shared.z);
    }
    return new Float32Array(pts);
  }, [model, byId, shared]);

  return (
    <>
      {model.nodes.map((n) => (
        <group key={n.id} position={n.position}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
              setHover(n.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(n.id);
            }}
          >
            <sphereGeometry args={[hover === n.id ? 0.28 : 0.2, 24, 24]} />
            <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.35} />
          </mesh>
          {n.choke && <ChokePulse position={[0, 0, 0]} />}
        </group>
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={model.edges[0]?.color ?? "#06b6d4"} transparent opacity={0.7} />
      </lineSegments>
      <ambientLight intensity={0.7} />
      <pointLight position={[5, 5, 5]} />
      <OrbitControls makeDefault enableDamping={false} />
    </>
  );
}

export function AttackGraph3D({
  graph,
  status = "open",
  height = 420,
}: {
  graph: ServerGraph | null | undefined;
  status?: string;
  height?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  if (!graph || !graph.nodes.length) {
    return <p className="text-sm text-[var(--soc-ink-faint)]">No graph data for this incident.</p>;
  }

  const fallback = (
    <ul className="text-sm text-[var(--soc-ink)]" data-testid="graph-fallback">
      {graph.nodes.map((n) => (
        <li key={n.id} className="font-mono-soc">
          {n.kind}: {n.label}
          {n.choke ? " [choke]" : ""}
        </li>
      ))}
      {graph.edges.map((e, i) => (
        <li key={i} className="text-[var(--soc-ink-faint)]">
          {e.from} --{e.label}--&gt; {e.to}
        </li>
      ))}
    </ul>
  );

  let canvas: React.ReactNode;
  try {
    canvas = (
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 4, 9] }}
        style={{ height, background: "#070a0c" }}
        onPointerMissed={() => setSelected(null)}
      >
        <Scene graph={graph} status={status} onSelect={setSelected} />
      </Canvas>
    );
  } catch {
    return fallback;
  }

  const sel = graph.nodes.find((n) => n.id === selected);
  return (
    <ErrorBoundary fallback={fallback}>
      <div style={{ height }} className="relative">
        {canvas}
        <div className="absolute right-2 top-2 w-56 rounded border border-[var(--soc-border)] bg-[var(--soc-surface)] p-2 text-xs no-print">
          {!sel ? (
            <p className="text-[var(--soc-ink-dim)]">Click a node for telemetry. Drag to orbit.</p>
          ) : (
            <div>
              <p className="font-mono-soc text-[var(--soc-ink)]">{sel.label}</p>
              <p className="text-[var(--soc-ink-dim)]">
                kind={sel.kind} risk={sel.risk ?? 0}
                {sel.choke ? " CHOKE" : ""}
              </p>
              <button
                className="mt-1 text-[var(--soc-accent)]"
                onClick={() => {
                  setSelected(null);
                  setDrag(!drag);
                }}
              >
                clear
              </button>
            </div>
          )}
        </div>
      </div>
      <noscript>{fallback}</noscript>
    </ErrorBoundary>
  );
}

export default AttackGraph3D;
