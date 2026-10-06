"""Explainable criticality-first risk scoring. Count never enters the formula."""

SEVERITY_W = {"Low": 10, "Medium": 40, "High": 70, "Critical": 95}


def alert_risk(severity: str, criticality: int, confidence: float,
               ioc_match: int, anomaly: float,
               suppressed: bool = False) -> tuple[float, dict]:
    sev = SEVERITY_W.get(severity, 10)
    crit = criticality * 20
    conf = confidence * 100
    ioc = ioc_match * 100
    parts = {
        "severity_part": round(0.30 * sev, 1),
        "criticality_part": round(0.30 * crit, 1),
        "confidence_part": round(0.15 * conf, 1),
        "ioc_part": round(0.10 * ioc, 1),
        "anomaly_part": round(0.15 * anomaly, 1),
    }
    score = round(min(100.0, sum(parts.values())), 1)
    if suppressed:
        score = round(score * 0.3, 1)
        parts["suppressed"] = True
    return score, parts


def incident_risk(scores: list[float], distinct_techniques: int) -> float:
    if not scores:
        return 0.0
    mx, mean = max(scores), sum(scores) / len(scores)
    return round(min(100.0, 0.6 * mx + 0.4 * mean + min(10, 2 * distinct_techniques)), 1)


def to_priority(r: float) -> str:
    if r >= 80:
        return "P1"
    if r >= 60:
        return "P2"
    if r >= 40:
        return "P3"
    return "P4"


def why_it_matters(n_crit: int, asset_id: str, criticality: int,
                   technique: str, n_low: int, low_host: str,
                   low_crit: int) -> str:
    return (f"{n_crit} Critical alerts on {asset_id} (criticality {criticality}/5)"
            f" with {technique} outranks {n_low} Low alerts on {low_host}"
            f" (criticality {low_crit}/5)")
