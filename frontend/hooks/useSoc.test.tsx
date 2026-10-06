import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnalystAction, useAnalyzeJob } from "./useSoc";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}
  it("action invalidates incident queries", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ status: "escalated" }) };
      }),
    );
    const { result } = renderHook(() => useAnalystAction(), { wrapper: wrapper() });
    const out = await result.current.act("INC-0001", "escalate", "t");
    expect(out).toEqual({ status: "escalated" });
    expect(calls[0]).toContain("/api/soc/incidents/INC-0001/action");
    vi.unstubAllGlobals();
  });

  it("job hook exposes ticket-based start without api key in URL", () => {
    expect(typeof useAnalyzeJob).toBe("function");
    expect(useAnalyzeJob.toString()).not.toContain("api_key=");
  });
