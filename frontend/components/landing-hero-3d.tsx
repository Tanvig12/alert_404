'use client';

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Deterministic PRNG so the hero layout is stable across renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function LandingHero3D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    let disposed = false;
    const disposables: Array<{ dispose(): void }> = [];
    let onMove: ((e: MouseEvent) => void) | null = null;
    let observer: IntersectionObserver | null = null;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    const active = renderer as THREE.WebGLRenderer;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 1.2, 9);

    const rand = mulberry32(7);
    const COUNT = 90;
    const pts = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const node = new THREE.Color("#06b6d4");
    const hub = new THREE.Color("#f59e0b");
    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const r = 2.2 + rand() * 2.4;
      const theta = rand() * Math.PI * 2;
      pts[i * 3] = Math.cos(theta) * r;
      pts[i * 3 + 1] = (rand() - 0.5) * 4.4;
      pts[i * 3 + 2] = Math.sin(theta) * r - 1;
      tmp.copy(rand() > 0.88 ? hub : node);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    disposables.push(pointGeo);
    const pointMat = new THREE.PointsMaterial({ size: 0.09, vertexColors: true });
    disposables.push(pointMat);
    scene.add(new THREE.Points(pointGeo, pointMat));

    const edgePts: number[] = [];
    for (let i = 0; i < COUNT && edgePts.length / 6 < 140; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = pts[i * 3] - pts[j * 3];
        const dy = pts[i * 3 + 1] - pts[j * 3 + 1];
        const dz = pts[i * 3 + 2] - pts[j * 3 + 2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 1.6 && edgePts.length / 6 < 140) {
          edgePts.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2]);
        }
      }
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgePts), 3));
    disposables.push(edgeGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: "#1e2c33", transparent: true, opacity: 0.8 });
    disposables.push(edgeMat);
    scene.add(new THREE.LineSegments(edgeGeo, edgeMat));

    const resize = () => {
      if (disposed || !canvas.parentElement) return;
      const w = canvas.parentElement.clientWidth || 800;
      const h = canvas.parentElement.clientHeight || 600;
      active.setSize(w, h, false);
      active.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    let targetX = 0;
    let targetY = 0;
    onMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.3;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.3;
    };
    window.addEventListener("mousemove", onMove);

    let visible = true;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      observer.observe(canvas);
    }

    const render = (t: number) => {
      if (!reduced) {
        scene.rotation.y = t * 0.00006 + targetX * 0.5;
        scene.rotation.x += (targetY * 0.5 - scene.rotation.x) * 0.05;
      }
      active.render(scene, camera);
    };

    if (reduced) {
      render(0);
    } else {
      const loop = (t: number) => {
        if (disposed) return;
        if (visible) render(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (onMove) window.removeEventListener("mousemove", onMove);
      observer?.disconnect();
      for (const d of disposables) d.dispose();
      active.dispose();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
