"""Brain client — ensemble anomaly; any failure degrades to 50.0 DL parts."""
import math
import os

import httpx
from sklearn.ensemble import IsolationForest

BRAIN_URL = os.getenv("BRAIN_URL", "http://127.0.0.1:8082/score")
SEV_NUM = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}

_brain_state: str = "ok"  # "ok" | "degraded"


def brain_state() -> str:
    return _brain_state


def _iforest_scores(alerts: list) -> list[float]:
    if len(alerts) < 50:
        return [50.0] * len(alerts)
    X = [[a.confidence, float(a.ioc_match), float(SEV_NUM.get(a.severity, 1))]
         for a in alerts]
    clf = IsolationForest(contamination=0.05, random_state=42)
    raw = clf.fit_predict(X)  # 1 normal, -1 anomaly
    scores = clf.score_samples(X)
    lo, hi = min(scores), max(scores)
    span = (hi - lo) or 1.0
    return [round(100.0 * (1.0 - (s - lo) / span), 1) if r == -1
            else round(100.0 * 0.5 * (1.0 - (s - lo) / span), 1)
            for r, s in zip(raw, scores)]


async def ensemble_anomaly(alerts: list, criticality: dict[str, int]) -> list[float]:
    """Returns per-alert ensemble 0-100. Sets module brain_state ok|degraded."""
    global _brain_state
    iforest = _iforest_scores(alerts)
    if not BRAIN_URL:
        _brain_state = "degraded"
        return [round(0.40 * i + 0.35 * 50.0 + 0.25 * 50.0, 1) for i in iforest]
    windows = []
    for a in alerts:
        try:
            h = a.timestamp.hour + a.timestamp.minute / 60.0
        except AttributeError:
            h = 12.0
        windows.append({
            "seq": [a.event_type],
            "numeric": [a.confidence, float(a.ioc_match),
                        float(SEV_NUM.get(a.severity, 1)),
                        float(criticality.get(a.asset_id, 3)),
                        math.sin(2 * math.pi * h / 24.0),
                        math.cos(2 * math.pi * h / 24.0)],
        })
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            url = BRAIN_URL if BRAIN_URL.endswith("/score") else BRAIN_URL.rstrip("/") + "/score"
            r = await client.post(url, json={"windows": windows})
            r.raise_for_status()
            data = r.json()
            if not data.get("trained", True):
                raise ValueError("brain untrained")
            parts = data["scores"]
    except Exception:
        _brain_state = "degraded"
        return [round(0.40 * i + 0.35 * 50.0 + 0.25 * 50.0, 1) for i in iforest]
    _brain_state = "ok"
    out = []
    for i, p in zip(iforest, parts):
        out.append(round(0.40 * i + 0.35 * p.get("lstm_surprise", 50.0)
                         + 0.25 * p.get("ae_error", 50.0), 1))
    return out
