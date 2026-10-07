"""AI briefs via free OpenRouter models -> Ollama -> rules. Never raises."""
import json
import os

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
# Probed alive 2026-10-07: nemotron-3-super answers JSON briefs directly (~3s).
# nemotron-3-ultra is the backup; dots-3 is a reasoner (content arrives late,
# needs a larger token budget). gemma/qwen/llama IDs seen in older configs are
# dead or rate-limited on the shared pool as of this writing.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL",
                             "nvidia/nemotron-3-super-120b-a12b:free")
OPENROUTER_FALLBACKS = os.getenv(
    "OPENROUTER_FALLBACKS",
    "nvidia/nemotron-3-ultra-550b-a55b:free,"
    "dots-studio/dots-3-note-preview:free").split(",")
# Reasoners spend tokens on hidden chain-of-thought before answering; give them
# room so `content` is populated when we read the response.
REASONER_MODELS = ("dots-studio/dots-3-note-preview:free",)
DIRECT_MAX_TOKENS = 600
REASONER_MAX_TOKENS = 2000
SUMMARY_MAX_TOKENS = 1200
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
OLLAMA_URL = os.getenv("OLLAMA_URL", "")

SYSTEM_PROMPT = (
    "You are a Tier-1 SOC analyst writing for the next shift. Return ONLY JSON "
    "with keys headline, executive_summary (<=40 words, names the asset and "
    "the primary MITRE technique), attack_hypothesis (exactly 1 sentence, "
    "names the asset and the technique), key_evidence (array of exactly 3 "
    "alert IDs copied from the input), mitre_attack (array of technique IDs "
    "seen in the input), recommended_actions (array of exactly 3; each names "
    "a concrete tool, host, or alert ID — never a bare verb like "
    "'isolate/monitor/investigate' without a named target), "
    "analyst_questions (array of exactly 2, each references the asset or an "
    "alert ID), severity, confidence. Never invent IPs, users, or hostnames."
)

SUMMARY_SYSTEM_PROMPT = (
    "You are the outgoing SOC shift lead writing the handoff summary for the "
    "incoming shift. Return ONLY JSON with keys executive_summary (<=40 "
    "words, states total open P1/P2 count and the single most urgent "
    "incident ID), now_watch (array of up to 5 incident IDs from the input, "
    "most urgent first), next_shift_priorities (array of exactly 3 strings; "
    "each names a concrete incident ID, asset, or technique plus the action), "
    "detection_gaps (array of 1-2 strings naming uncovered techniques or "
    "blind spots seen in the input), signoff_notes (1 sentence: what is "
    "resolved vs what still needs eyes). Every priority must name a real ID "
    "from the input. Never invent incidents, assets, or techniques."
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


def rules_shift_summary(queue: dict, ai_error: str = "") -> dict:
    """Offline fallback for the shift summary. Never raises."""
    counts = queue.get("counts", {})
    top = queue.get("top_p1", [])
    open_p1 = counts.get("P1_open", 0)
    open_p2 = counts.get("P2_open", 0)
    head = top[0] if top else {}
    # prefer distinct assets so the list never reads as one line repeated
    seen: set[str] = set()
    ordered: list[dict] = []
    for t in top[:5]:
        if t.get("asset_id") not in seen:
            seen.add(t.get("asset_id", ""))
            ordered.append(t)
    ordered += [t for t in top[:5] if t not in ordered]
    priorities = [
        (f"Triage {t.get('id', '')} on {t.get('asset_id', '—')} "
         f"({t.get('primary_technique', '—')}, risk {t.get('risk_score', '—')})")
        for t in ordered[:3]
    ] or ["Queue is clear — run an analysis to form the triage queue."]
    return {
        "executive_summary": (
            f"{open_p1} P1 and {open_p2} P2 incidents open. "
            f"Most urgent: {head.get('id', 'none')} on "
            f"{head.get('asset_id', '—')} ({head.get('primary_technique', '—')})."
        ),
        "now_watch": [t.get("id", "") for t in top[:5] if t.get("id")],
        "next_shift_priorities": priorities,
        "detection_gaps": [
            f"Technique {t} has no confirmed coverage this shift."
            for t in (queue.get("uncovered_techniques") or [])[:2]
        ] or ["No uncovered techniques recorded this shift."],
        "signoff_notes": (
            f"Brain state: {queue.get('brain_state', 'unknown')} "
            f"(DL anomaly parts {'live' if queue.get('brain_state') == 'ok' else 'degraded to 50.0'}). "
            f"{counts.get('escalated', 0)} escalated, "
            f"{counts.get('open', 0)} still open."
        ),
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


def _parse_summary(text: str, valid_ids: set[str]) -> dict | None:
    """Validate an LLM shift summary; IDs must come from the queue snapshot."""
    import re
    try:
        start, end = text.index("{"), text.rindex("}")
        obj = json.loads(text[start:end + 1])
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(obj.get("executive_summary"), str):
        return None
    if not isinstance(obj.get("next_shift_priorities"), list):
        return None
    # models decorate IDs ("INC-0121 – P1 open"); extract the bare ID
    watch = []
    for w in (obj.get("now_watch") or []):
        m = re.search(r"INC-\d+", str(w))
        if m and m.group(0) in valid_ids and m.group(0) not in watch:
            watch.append(m.group(0))
    obj["now_watch"] = watch[:5]
    if not isinstance(obj.get("detection_gaps"), list):
        obj["detection_gaps"] = []
    if not isinstance(obj.get("signoff_notes"), str):
        obj["signoff_notes"] = ""
    return obj


@retry(stop=stop_after_attempt(3),
       wait=wait_exponential(multiplier=1, min=2, max=10),
       reraise=True)
def _post_openrouter(payload: dict, headers: dict) -> httpx.Response:
    return httpx.post("https://openrouter.ai/api/v1/chat/completions",
                      json=payload, headers=headers, timeout=60.0)


def _max_tokens_for(model: str) -> int:
    if any(r in model for r in REASONER_MODELS):
        return REASONER_MAX_TOKENS
    return DIRECT_MAX_TOKENS


def _openrouter_headers() -> dict:
    return {"Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": FRONTEND_URL, "X-Title": "SOC Sentinel AI"}


async def _chat_openrouter(model: str, system: str, user_payload: dict,
                           temperature: float,
                           max_tokens: int | None = None,
                           ) -> tuple[str | None, str, bool]:
    """One OpenRouter call. Returns (content, model_used, fallback_used)."""
    import anyio
    budget = max_tokens if max_tokens is not None else _max_tokens_for(model)
    payload = {
        "model": model, "models": OPENROUTER_FALLBACKS,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
        "temperature": temperature, "max_tokens": budget,
        "response_format": {"type": "json_object"},
        "provider": {"allow_fallbacks": True},
    }
    resp = await anyio.to_thread.run_sync(
        lambda: _post_openrouter(payload, _openrouter_headers()))
    if resp.status_code != 200:
        raise RuntimeError(f"openrouter_{resp.status_code}")
    body = resp.json()
    msg = body["choices"][0]["message"]
    text = msg.get("content") or ""
    used = body.get("model", model)
    return text, used, used != model


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
        try:
            text, model, fb = await _chat_openrouter(
                OPENROUTER_MODEL, SYSTEM_PROMPT,
                {"incident": incident, "alerts": alert_dicts[:8],
                 "mitre": mitre, "risk": risk}, 0.3)
            parsed = _parse(text, valid_ids)
            if parsed is not None:
                parsed["provider"] = "openrouter"
                parsed["model"] = model
                parsed["fallback_used"] = fb
                return parsed
            err = "openrouter_bad_json"
        except Exception as e:
            err = (str(e) if str(e).startswith("openrouter_")
                   else f"openrouter_error_{type(e).__name__}")
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


async def generate_shift_summary(queue: dict) -> dict:
    """One LLM call over the aggregated queue snapshot. Never raises.

    Falls back to rules_shift_summary (offline-deterministic) when no key,
    when the model errors, or when the JSON fails validation — so the
    handoff page always renders something genuine to the snapshot.
    """
    valid_ids = {t.get("id", "") for t in queue.get("top_p1", [])}
    valid_ids |= {t.get("id", "") for t in queue.get("top_p2", [])}
    valid_ids.discard("")

    if OPENROUTER_API_KEY:
        try:
            text, model, fb = await _chat_openrouter(
                OPENROUTER_MODEL, SUMMARY_SYSTEM_PROMPT, queue, 0.3,
                max_tokens=SUMMARY_MAX_TOKENS)
            parsed = _parse_summary(text, valid_ids)
            if parsed is not None:
                parsed["provider"] = "openrouter"
                parsed["model"] = model
                parsed["fallback_used"] = fb
                return parsed
            err = "openrouter_bad_json"
        except Exception as e:
            err = (str(e) if str(e).startswith("openrouter_")
                   else f"openrouter_error_{type(e).__name__}")
    else:
        err = "no_openrouter_key"
    return rules_shift_summary(queue, ai_error=err)
