
def generate_fallback_summary(incident, correlation=None, risk=None, mitre=None):
    title = incident.get("title", "Security incident")
    asset = incident.get("asset", "unknown asset")
    severity = incident.get("severity", "medium").lower()

    if severity not in ["critical", "high", "medium", "low"]:
        severity = "medium"

    actions = {
        "critical": ["Isolate the asset.", "Notify the security team."],
        "high": ["Check the activity.", "Block access if it is malicious."],
        "medium": ["Review logs.", "Monitor the asset."],
        "low": ["Save the alert.", "Keep monitoring."],
    }

    return {
        "headline": title,
        "executive_summary": f"{severity.title()} alert on {asset}.",
        "attack_hypothesis": "More investigation is needed.",
        "key_evidence": [incident],
        "mitre_attack": mitre or {},
        "recommended_actions": actions[severity],
        "analyst_questions": ["Is this activity expected?"],
        "severity": severity,
        "confidence": 0.35,
        "correlation": correlation or {},
        "risk": risk or {},
        "provider": "rules",
        "fallback_used": True,
    }