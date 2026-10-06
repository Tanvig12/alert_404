"""AI briefs via free OpenRouter models -> Ollama -> rules. Never raises."""
import json
import os

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL",
                             "qwen/qwen3-next-80b-a3b-instruct:free")
OPENROUTER_FALLBACKS = os.getenv(
    "OPENROUTER_FALLBACKS",
    "google/gemma-4-31b-it:free,meta-llama/llama-3.3-70b-instruct:free").split(",")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
OLLAMA_URL = os.getenv("OLLAMA_URL", "")

SYSTEM_PROMPT = (
    "You are a Tier-1 SOC analyst. Return ONLY JSON with keys headline,"
    " executive_summary<=120 words, attack_hypothesis, key_evidence[3],"
    " mitre_attack, recommended_actions[3-5], analyst_questions[3],"
    " severity, confidence. Never invent IPs, users, or hostnames."
)

RULES_ACTIONS = {
    "Critical": ["Isolate host from network immediately",
                 "Capture memory + disk forensic images",
                 "Reset credentials for affected users",
                 "Block C2 IOCs at egress firewall"],
    "High": ["Quarantine host for forensic review",
             "Hunt laterally for same IOCs across fleet",
             "Force password rotation for involved accounts"],
    "Medium": ["Open investigation ticket and monitor host 48h",
               "Verify EDR coverage on affected asset"],
    "Low": ["Log and monitor; review in weekly queue"],
}


def rules_brief(incident: dict, alerts: list[dict], ai_error: str = "") -> dict:
    sev = incident.get("severity", "Low")
    sev = {"P1": "Critical", "P2": "High", "P3": "Medium",
           "P4": "Low"}.get(sev, sev)
    ev = [{"alert_id": a["alert_id"], "event_type": a["event_type"],
           "hostname": a["hostname"]} for a in alerts[:3]]
    return {
        "headline": f"{incident.get('severity')} incident on "
                    f"{incident.get('asset_id')} ({incident.get('alert_count')} alerts)",
        "executive_summary": f"Rules-based brief for {incident.get('id')}: "
                             f"{incident.get('alert_count')} alerts, primary technique "
                             f"{incident.get('primary_technique', 'unknown')}.",
        "attack_hypothesis": "Pending analyst review (rules fallback).",
        "key_evidence": ev,
        "mitre_attack": [incident.get("primary_technique", "")],
        "recommended_actions": RULES_ACTIONS.get(sev, RULES_ACTIONS["Low"]),
        "analyst_questions": ["Is this asset internet-exposed?",
                              "Any recent credential changes?",
                              "Are peer hosts showing the same IOCs?"],
        "severity": sev, "confidence": 0.4,
        "provider": "rules", "model": "rules",
        "fallback_used": True, "ai_error": ai_error,
    }


def _parse(text: str, valid_ids: set[str]) -> dict | None:
    try:
        start, end = text.index("{"), text.rindex("}")
        obj = json.loads(text[start:end + 1])
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(obj.get("key_evidence"), list):
        return None
    # key_evidence values must be subsets of input alerts
    kept = []
    for e in obj["key_evidence"][:3]:
        if isinstance(e, dict) and e.get("alert_id") in valid_ids:
            kept.append(e)
        elif isinstance(e, str) and e in valid_ids:
            kept.append({"alert_id": e})
    obj["key_evidence"] = kept
    return obj


@retry(stop=stop_after_attempt(3),
       wait=wait_exponential(multiplier=1, min=2, max=10),
       reraise=True)
def _post_openrouter(payload: dict, headers: dict) -> httpx.Response:
    return httpx.post("https://openrouter.ai/api/v1/chat/completions",
                      json=payload, headers=headers, timeout=30.0)


async def generate_brief(incident: dict, alerts: list[dict],
                         mitre: list[dict], risk: dict) -> dict:
    """Always returns a brief dict with provider/model/fallback_used."""
    alert_dicts = [{
        "alert_id": a.alert_id, "event_type": a.event_type,
        "hostname": a.hostname, "source_ip": str(a.source_ip),
        "username": a.username, "severity": a.severity,
        "description": a.description, "confidence": a.confidence,
    } for a in alerts]
    valid_ids = {a.alert_id for a in alerts}

    if OPENROUTER_API_KEY:
        payload = {
            "model": OPENROUTER_MODEL, "models": OPENROUTER_FALLBACKS,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({
                    "incident": incident, "alerts": alert_dicts[:8],
                    "mitre": mitre, "risk": risk})},
            ],
            "temperature": 0.1, "max_tokens": 600,
            "response_format": {"type": "json_object"},
            "provider": {"allow_fallbacks": True},
        }
        headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}",
                   "HTTP-Referer": FRONTEND_URL, "X-Title": "SOC Sentinel AI"}
        try:
            import anyio
            resp = await anyio.to_thread.run_sync(
                lambda: _post_openrouter(payload, headers))
            if resp.status_code == 200:
                body = resp.json()
                text = body["choices"][0]["message"]["content"]
                parsed = _parse(text, valid_ids)
                model = body.get("model", OPENROUTER_MODEL)
                if parsed is not None:
                    parsed["provider"] = "openrouter"
                    parsed["model"] = model
                    parsed["fallback_used"] = model != OPENROUTER_MODEL
                    return parsed
                return rules_brief(incident, alert_dicts,
                                   ai_error="openrouter_bad_json")
            err = f"openrouter_{resp.status_code}"
        except Exception as e:
            err = f"openrouter_error_{type(e).__name__}"
        # fall through to ollama/rules, keep err
    else:
        err = "no_openrouter_key"

    if OLLAMA_URL:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    OLLAMA_URL.rstrip("/") + "/api/chat",
                    json={"model": "llama3.1:8b", "stream": False,
                          "messages": [
                              {"role": "system", "content": SYSTEM_PROMPT},
                              {"role": "user", "content": json.dumps({
                                  "incident": incident,
                                  "alerts": alert_dicts[:8]})}]})
                if r.status_code == 200:
                    parsed = _parse(r.json()["message"]["content"], valid_ids)
                    if parsed is not None:
                        parsed["provider"] = "ollama"
                        parsed["model"] = "llama3.1:8b"
                        parsed["fallback_used"] = True
                        return parsed
        except Exception:
            pass
        return rules_brief(incident, alert_dicts, ai_error="ollama_failed")
    return rules_brief(incident, alert_dicts, ai_error=err)
