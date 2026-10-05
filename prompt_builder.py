import json


def build_incident_prompt(incident, correlation=None, risk=None, mitre=None):
    # Put all project data together for the AI.
    data = {
        "incident": incident,
        "correlation": correlation or {},
        "risk": risk or {},
        "mitre": mitre or {},
    }
    return (
        "You are a security analyst. Read this incident and return only JSON. "
        "Use these keys: headline, executive_summary, attack_hypothesis, key_evidence, "
        "mitre_attack, recommended_actions, analyst_questions, severity, confidence.\n"
        + json.dumps(data)
    )
