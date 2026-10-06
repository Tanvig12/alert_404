'use client';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

async function soc(path: string, init?: RequestInit) {
  const r = await fetch(`/api/soc/${path}`, init);
  if (!r.ok) throw new Error(`soc ${path}: ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  return ct.includes("markdown") ? r.text() : r.json();
}

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => soc("dashboard") });
}

export function useIncidents(params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: ["incidents", qs],
    queryFn: () => soc(`incidents${qs ? `?${qs}` : ""}`),
  });
}

export function useIncident(id: string) {
  return useQuery({ queryKey: ["incident", id], queryFn: () => soc(`incidents/${id}`) });
}

export function useNavigator() {
  return useQuery({ queryKey: ["navigator"], queryFn: () => soc("navigator") });
}

export function useEvaluation() {
  return useQuery({ queryKey: ["evaluation"], queryFn: () => soc("evaluation") });
}

export function useAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      soc("analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["evaluation"] });
    },
  });
}

export interface JobFrame {
  stage: string;
  done: number;
  total: number;
  result?: unknown;
}

const WS_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL) || "ws://localhost:8000";

export function useAnalyzeJob() {
  const [frame, setFrame] = useState<JobFrame>({ stage: "idle", done: 0, total: 0 });
  const [running, setRunning] = useState(false);

  async function start(body: unknown) {
    setRunning(true);
    setFrame({ stage: "ingest", done: 0, total: 0 });
    try {
      const { job_id } = await soc("jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const { ticket } = await soc(`jobs/${job_id}/ticket`, { method: "POST" });
          const ws = new WebSocket(`${WS_URL}/api/v1/jobs/${job_id}?ticket=${ticket}`);
          const { promise, resolve, reject } = Promise.withResolvers<void>();
          ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.status === "done") {
              ws.close();
              resolve();
              return;
            }
            if (msg.status === "error") {
              ws.close();
              reject(new Error(msg.detail ?? "job failed"));
              return;
            }
            setFrame({ stage: msg.stage, done: msg.done, total: msg.total });
          };
          ws.onerror = () => reject(new Error("ws error"));
          const timer = setTimeout(() => {
            try {
              ws.close();
            } catch {
              /* already closed */
            }
            reject(new Error("ws timeout"));
          }, 120000);
          await promise;
          clearTimeout(timer);
          const status = await soc(`jobs/${job_id}`);
          setFrame({ stage: "done", done: 1, total: 1, result: status.result });
          break;
        } catch (e) {
          if (attempt === 3) {
            setFrame({ stage: "error", done: 0, total: 0 });
            throw e;
          }
          const { promise: wait, resolve: wake } = Promise.withResolvers<void>();
          setTimeout(wake, 1000);
          await wait;
        }
      }
    } finally {
      setRunning(false);
    }
  }

  return { ...frame, running, start };
}

export function useAnalystAction() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function act(id: string, action: string, note = "") {
    setBusy(true);
    try {
      const out = await soc(`incidents/${id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["evaluation"] });
      return out;
    } finally {
      setBusy(false);
    }
  }

  return { act, busy };
}
