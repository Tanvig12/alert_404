import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const DEMO_API_KEY = process.env.DEMO_API_KEY ?? "demo-key-change-me";

async function proxy(req: NextRequest, path: string[]) {
  const target = `${BACKEND_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = { "X-API-Key": DEMO_API_KEY };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  const rid = req.headers.get("x-request-id");
  if (rid) headers["x-request-id"] = rid;
  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }
  let resp: Response;
  try {
    resp = await fetch(target, { method: req.method, headers, body });
  } catch {
    return NextResponse.json({ detail: "backend unreachable" }, { status: 502 });
  }
  const buf = await resp.arrayBuffer();
  const outCt = resp.headers.get("content-type") ?? "application/json";
  return new NextResponse(buf, { status: resp.status, headers: { "content-type": outCt } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
