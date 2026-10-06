import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import OverviewClient from "@/components/overview-client";

export const dynamic = "force-dynamic";

async function fetchDashboard() {
  const base = process.env.BACKEND_URL ?? "http://localhost:8000";
  const key = process.env.DEMO_API_KEY ?? "demo-key-change-me";
  try {
    const r = await fetch(`${base}/api/v1/dashboard`, {
      headers: { "X-API-Key": key },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const qc = new QueryClient();
  const initial = await fetchDashboard();
  if (initial) qc.setQueryData(["dashboard"], initial);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <OverviewClient initial={initial} />
    </HydrationBoundary>
  );
}
