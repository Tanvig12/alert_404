"""Correlator client — Rust primary, None on any failure (mirror fallback)."""
import os

import httpx

CORRELATOR_URL = os.getenv("CORRELATOR_URL", "http://127.0.0.1:8081/correlate")


async def correlate_via_rust(alerts: list,
                             tactics: dict[str, str | None],
                             window_hours: int = 6) -> list[list] | None:
    if not CORRELATOR_URL:
        return None
    payload_alerts = [{
        "alert_id": a.alert_id,
        "timestamp": a.timestamp.isoformat(),
        "asset_id": a.asset_id,
        "source_ip": str(a.source_ip),
        "username": a.username,
        "tactic": tactics.get(a.alert_id),
    } for a in alerts]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(CORRELATOR_URL.rstrip("/") + "/correlate"
                                  if not CORRELATOR_URL.endswith("/correlate")
                                  else CORRELATOR_URL,
                                  json={"alerts": payload_alerts,
                                        "window_hours": window_hours})
            r.raise_for_status()
            data = r.json()
    except Exception:
        return None
    by_id = {a.alert_id: a for a in alerts}
    groups = []
    for g in data.get("groups", []):
        grp = [by_id[i] for i in g if i in by_id]
        if grp:
            groups.append(grp)
    return groups
