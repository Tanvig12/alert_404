"""Free typed triage decisions: self-hosted `jeff` or null. No paid Jev."""

import os

import httpx

JEFF_URL = os.getenv("JEFF_URL", "")


async def triage_incident(headline: str, evidence: list[str],
                          severity: str) -> dict | None:
    """Returns jev_decision dict or None. Never raises, never blocks pipeline."""
    if not JEFF_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                JEFF_URL.rstrip("/") + "/v1/systemone",
                json={"questions": [
                    {"type": "noul",
                     "question": f"Does this incident need escalation? {headline} "
                                 f"Severity {severity}. Evidence: {'; '.join(evidence[:3])}"},
                    {"type": "choice",
                     "question": f"Disposition for {headline}?",
                     "choices": ["true_positive", "benign", "needs_review"]},
                    {"type": "score",
                     "question": f"Confidence this incident is a real threat? {headline}"},
                ]})
            r.raise_for_status()
            data = r.json()
            ans = data.get("answers", data if isinstance(data, list) else [])
            need = float(ans[0].get("score", ans[0].get("value", 0.0))
                         if len(ans) > 0 else 0.0)
            disp = str(ans[1].get("value", ans[1].get("label", "needs_review"))
                       if len(ans) > 1 else "needs_review")
            conf = float(ans[2].get("score", ans[2].get("value", 0.5))
                         if len(ans) > 2 else 0.5)
            if disp not in ("true_positive", "benign", "needs_review"):
                disp = "needs_review"
            if conf < 0.55:
                disp = "needs_review"
            return {"needs_escalation": round(need, 3),
                    "disposition": disp,
                    "disposition_confidence": round(conf, 3),
                    "score": round(need, 3),
                    "source": "jeff", "cost": 0.0}
    except Exception:
        return None
