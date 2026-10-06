"""MITRE ATT&CK mapping — Python owns tactic mapping; Rust never sees MITRE."""
from collections import Counter

EVENT_TO_TECHNIQUE = {
    "brute_force": "T1110",
    "lateral_movement": "T1021",
    "powershell_execution": "T1059.001",
    "lsass_dump": "T1003.001",
    "phishing_click": "T1566.002",
    "privilege_escalation": "T1548.002",
    "ransomware_encryption": "T1486",
    "c2_beacon": "T1071.001",
    "data_exfiltration": "T1567",
    "valid_account_login": "T1078",
    "external_exploit": "T1190",
    "vpn_anomaly": "T1133",
}

TECHNIQUE_TO_TACTIC = {
    "T1110": "Credential-Access",
    "T1021": "Lateral-Movement",
    "T1059.001": "Execution",
    "T1003.001": "Credential-Access",
    "T1566.002": "Initial-Access",
    "T1548.002": "Privilege-Escalation",
    "T1486": "Impact",
    "T1071.001": "Command-And-Control",
    "T1567": "Exfiltration",
    "T1078": "Defense-Evasion",
    "T1190": "Initial-Access",
    "T1133": "Persistence",
}

TACTIC_ORDER = ["Initial-Access", "Execution", "Persistence",
                "Privilege-Escalation", "Defense-Evasion", "Credential-Access",
                "Lateral-Movement", "Exfiltration", "Command-And-Control",
                "Impact"]

# Bundled static fallback (ATT&CK v16.1 names); file enrich overrides names.
STATIC_ENRICH = {
    "T1110": ("Brute Force", "Credential Access", "Enforce MFA; lockout policy"),
    "T1021": ("Remote Services", "Lateral Movement", "Segment network; restrict RDP/SSH"),
    "T1059.001": ("PowerShell", "Execution", "Constrained language mode; script logging"),
    "T1003.001": ("LSASS Memory", "Credential Access", "Credential Guard; PPL protection"),
    "T1566.002": ("Spearphishing Link", "Initial Access", "Email filtering; user training"),
    "T1548.002": ("Bypass UAC", "Privilege Escalation", "UAC max; least privilege"),
    "T1486": ("Data Encrypted for Impact", "Impact", "Offline backups; EDR kill-switch"),
    "T1071.001": ("Web Protocols", "Command and Control", "Egress filtering; TLS inspection"),
    "T1567": ("Exfiltration Over Web", "Exfiltration", "DLP; egress allowlists"),
    "T1078": ("Valid Accounts", "Defense Evasion", "Rotate creds; behavioral analytics"),
    "T1190": ("Exploit Public-Facing App", "Initial Access", "Patch cadence; WAF"),
    "T1133": ("External Remote Services", "Persistence", "VPN MFA; geo allowlists"),
}

_attack_data = None


def _load_attack_data():
    global _attack_data
    if _attack_data is not None:
        return _attack_data
    try:
        from mitreattack.stix20 import MitreAttackData
        _attack_data = MitreAttackData("backend/data/enterprise-attack.json")
    except Exception:
        _attack_data = False
    return _attack_data


def map_alert(event_type: str) -> str | None:
    return EVENT_TO_TECHNIQUE.get(event_type)


def tactic_for(technique: str | None) -> str | None:
    if technique is None:
        return None
    return TECHNIQUE_TO_TACTIC.get(technique)


def enrich(ids: list[str]) -> list[dict]:
    out = []
    data = _load_attack_data()
    for tid in ids:
        name, tactic, mit = STATIC_ENRICH.get(tid, (tid, "Unknown", ""))
        if data:
            try:
                objs = data.get_objects_by_attack_id(tid, "attack-pattern")
                if objs:
                    o = objs[0]
                    name = o.get("name", name)
            except Exception:
                pass
        out.append({"id": tid, "name": name, "tactic": tactic,
                    "mitigation": mit})
    return out


def primary_technique(ids: list[str | None]) -> str:
    known = [i for i in ids if i]
    if not known:
        return ""
    return Counter(known).most_common(1)[0][0]


def attack_stage(techniques: list[str]) -> list[str]:
    tactics = sorted({TECHNIQUE_TO_TACTIC.get(t, "") for t in techniques if t},
                     key=lambda t: TACTIC_ORDER.index(t) if t in TACTIC_ORDER else 99)
    return [t for t in tactics if t]


def build_graph(alerts: list, techniques: dict[str, str | None],
                risks: dict[str, float]) -> dict:
    """Chain source_ip->username->hostname->technique in time order.
    Choke point = highest-risk technique node."""
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(nid: str, kind: str, label: str, risk: float = 0.0) -> None:
        if nid not in nodes:
            nodes[nid] = {"id": nid, "kind": kind, "label": label,
                          "risk": risk}

    tech_risk: dict[str, float] = {}
    ordered = sorted(alerts, key=lambda a: a.timestamp.isoformat()
                     if hasattr(a.timestamp, "isoformat") else str(a.timestamp))
    for a in ordered:
        ip, user, host = str(a.source_ip), a.username, a.hostname
        r = risks.get(a.alert_id, 0.0)
        add_node(f"ip:{ip}", "ip", ip, r)
        add_node(f"user:{user}", "user", user, r)
        add_node(f"host:{host}", "host", host, r)
        edges.append({"from": f"ip:{ip}", "to": f"user:{user}",
                      "label": "auth-as"})
        edges.append({"from": f"user:{user}", "to": f"host:{host}",
                      "label": "on"})
        tid = techniques.get(a.alert_id)
        if tid:
            tech_risk[tid] = max(tech_risk.get(tid, 0.0), r)
            add_node(f"tech:{tid}", "technique", tid, tech_risk[tid])
            edges.append({"from": f"host:{host}", "to": f"tech:{tid}",
                          "label": "exhibits"})
    choke = max(tech_risk, key=lambda t: tech_risk[t], default=None)
    for n in nodes.values():
        n["choke"] = n["id"] == f"tech:{choke}" if choke else False
        if n["id"] == f"tech:{choke}":
            n["risk"] = tech_risk[choke]
    # Dedupe edges
    seen, deduped = set(), []
    for e in edges:
        k = (e["from"], e["to"], e["label"])
        if k not in seen:
            seen.add(k)
            deduped.append(e)
    return {"nodes": list(nodes.values()), "edges": deduped}
