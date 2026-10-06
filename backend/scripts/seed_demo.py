"""Seed demo: upload 3000 synthetic alerts, print judge-visible stats.

Usage: uv run --project backend python backend/scripts/seed_demo.py
Env: BACKEND_URL (default http://localhost:8000), DEMO_API_KEY.
"""
import csv
import json
import os
import time
import urllib.request

BASE = os.getenv("BACKEND_URL", "http://localhost:8000")
KEY = os.getenv("DEMO_API_KEY", "demo-key-change-me")


def call(method: str, path: str, body=None, raw: bytes | None = None,
         filename: str = "") -> dict:
    data = raw
    headers = {"X-API-Key": KEY}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers,
                                 method=method)
    if raw is not None:
        boundary = "SEEDBOUNDARY"
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        part = (f"--{boundary}\r\nContent-Disposition: form-data; "
                f"name=\"file\"; filename=\"{filename}\"\r\n"
                f"Content-Type: text/csv\r\n\r\n").encode() + raw + \
            f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(BASE + path, data=part, headers=headers,
                                     method=method)
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read().decode())


def main() -> None:
    t0 = time.time()
    with open("data/synthetic_alerts_3000.csv", "rb") as f:
        raw = f.read()
    out = call("POST", "/api/v1/upload", raw=raw, filename="alerts.csv")
    n_alerts = out["dashboard"]["total_alerts"]
    incidents = out["incidents"]
    p1 = sum(1 for d in incidents if d["severity"] == "P1")
    ev = call("GET", "/api/v1/evaluation")
    dash = call("GET", "/api/v1/dashboard")
    took = round(time.time() - t0, 1)
    print(f"alerts={n_alerts} incidents={len(incidents)} P1={p1} "
          f"campaign_recovery_pct={ev['campaign_recovery_pct']} "
          f"reduction_pct={dash['reduction_pct']} "
          f"brain={ev.get('brain')} triage={dash['triage_source_counts']} "
          f"f1={ev['f1']} took_s={took}")


if __name__ == "__main__":
    main()
