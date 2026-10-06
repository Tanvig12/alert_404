"""Line-for-line Python mirror of correlator/src/main.rs — fallback only.

Caller: analyze uses Rust result when non-None, else this mirror.
Ground-truth column is never read here.
"""
from datetime import datetime, timedelta


def _parse_ts(s: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=None)
    except ValueError:
        return None


def correlate(alerts: list[dict], tactics: dict[str, str | None],
              window_hours: int = 6) -> list[list[dict]]:
    """alerts: list of dicts with alert_id, timestamp, asset_id, source_ip, username.
    tactics: alert_id -> tactic str | None. Returns groups of alert dicts."""
    items = []
    for a in alerts:
        ts = _parse_ts(a["timestamp"]) if isinstance(a["timestamp"], str) else a["timestamp"]
        if ts is None:
            continue
        items.append({"ts": ts, "alert": a,
                      "tactic": tactics.get(a["alert_id"])})
    if not items:
        return []
    window = timedelta(hours=window_hours)
    max_span = timedelta(hours=24)
    by_asset: dict[str, list[dict]] = {}
    for it in items:
        by_asset.setdefault(it["alert"]["asset_id"], []).append(it)
    groups: list[list[dict]] = []
    for _asset, v in by_asset.items():
        v.sort(key=lambda x: x["ts"])
        cur: list[dict] = []
        start = v[0]["ts"]
        prev = v[0]["ts"]
        for it in v:
            gap = it["ts"] - prev
            span = it["ts"] - start
            if cur and (gap > window or span > max_span):
                groups.append(cur)
                cur = []
                start = it["ts"]
            prev = it["ts"]
            cur.append(it)
        if cur:
            groups.append(cur)
    merged: list[list[dict]] = []
    for g in groups:
        placed = False
        for m in merged:
            entity = any(
                a["alert"]["source_ip"] == b["alert"]["source_ip"]
                or a["alert"]["username"] == b["alert"]["username"]
                for a in g for b in m)
            if not entity:
                continue
            gmin = min(x["ts"] for x in g)
            gmax = max(x["ts"] for x in g)
            mmin = min(x["ts"] for x in m)
            mmax = max(x["ts"] for x in m)
            if not (gmin <= mmax and mmin <= gmax):
                continue
            shared = any(
                a["tactic"] is not None
                and any(b["tactic"] == a["tactic"] for b in m)
                for a in g)
            if shared:
                m.extend(g)
                placed = True
                break
        if not placed:
            merged.append(g)
    for m in merged:
        m.sort(key=lambda x: x["ts"])
    merged.sort(key=lambda g: max(x["ts"] for x in g), reverse=True)
    return [[it["alert"] for it in g] for g in merged]
