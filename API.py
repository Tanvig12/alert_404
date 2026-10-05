from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from collections import defaultdict
from datetime import datetime, timezone
import csv
import io
import json


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Alert Summarizer API",
    description="API for analyzing and summarizing security alerts.",
    version="1.0.0"
)


# ============================================================
# MODELS
# ============================================================

class Alert(BaseModel):
    alert_id: str
    timestamp: str
    source: str
    rule_name: str
    severity: str
    asset: str

    asset_criticality: int = Field(
        default=3,
        ge=1,
        le=5
    )

    user: Optional[str] = None
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    description: str = ""
    mitre_technique: Optional[str] = None


class AlertRequest(BaseModel):
    alerts: List[Alert]


# ============================================================
# CONSTANTS
# ============================================================

SEVERITY_SCORE = {
    "low": 20,
    "medium": 40,
    "high": 70,
    "critical": 90
}


MITRE_RULES = {
    "brute force": "T1110",
    "password spraying": "T1110.003",
    "phishing": "T1566",
    "spearphishing": "T1566.001",
    "powershell": "T1059.001",
    "command and scripting": "T1059",
    "malware": "T1204.002",
    "ransomware": "T1486",
    "scheduled task": "T1053.005",
    "credential dumping": "T1003",
    "process injection": "T1055",
    "remote desktop": "T1021.001",
    "rdp": "T1021.001",
    "wmi": "T1047",
    "exfiltration": "T1041"
}


# ============================================================
# MITRE DETECTION
# ============================================================

def detect_mitre(alert: Alert) -> Optional[str]:

    if alert.mitre_technique:
        return alert.mitre_technique

    text = (
        f"{alert.rule_name} "
        f"{alert.description}"
    ).lower()

    for keyword, technique in MITRE_RULES.items():
        if keyword in text:
            return technique

    return None


# ============================================================
# RISK CALCULATION
# ============================================================

def calculate_risk(alerts: List[Alert]) -> float:

    if not alerts:
        return 0.0

    highest_severity = max(
        SEVERITY_SCORE.get(
            alert.severity.lower(),
            40
        )
        for alert in alerts
    )

    highest_asset_criticality = max(
        alert.asset_criticality
        for alert in alerts
    )

    alert_volume_bonus = min(
        len(alerts) * 2,
        10
    )

    score = (
        highest_severity * 0.55
        + highest_asset_criticality * 9
        + alert_volume_bonus
    )

    return round(
        min(score, 100),
        2
    )


# ============================================================
# PRIORITY
# ============================================================

def get_priority(risk_score: float) -> str:

    if risk_score >= 80:
        return "P1"
    elif risk_score >= 60:
        return "P2"
    elif risk_score >= 40:
        return "P3"

    return "P4"


# ============================================================
# GROUP ALERTS
# ============================================================

def group_alerts(
    alerts: List[Alert]
) -> List[List[Alert]]:

    groups = defaultdict(list)

    for alert in alerts:

        try:
            timestamp = datetime.fromisoformat(
                alert.timestamp.replace(
                    "Z",
                    "+00:00"
                )
            )

            time_bucket = int(
                timestamp.timestamp() // 1800
            )

        except (ValueError, TypeError):
            time_bucket = 0

        key = (
            alert.asset,
            alert.user or "",
            alert.src_ip or "",
            time_bucket
        )

        groups[key].append(alert)

    return list(groups.values())


# ============================================================
# SUMMARY
# ============================================================

def generate_summary(
    alerts: List[Alert],
    risk_score: float
) -> str:

    if not alerts:
        return "No alerts available."

    asset = alerts[0].asset

    highest_severity_alert = max(
        alerts,
        key=lambda alert: SEVERITY_SCORE.get(
            alert.severity.lower(),
            40
        )
    )

    highest_severity = highest_severity_alert.severity

    asset_criticality = max(
        alert.asset_criticality
        for alert in alerts
    )

    techniques = []

    for alert in alerts:

        technique = detect_mitre(alert)

        if technique and technique not in techniques:
            techniques.append(technique)

    if techniques:
        mitre_text = ", ".join(techniques)
    else:
        mitre_text = "No MITRE ATT&CK technique detected"

    return (
        f"{len(alerts)} related security alert(s) "
        f"were detected on asset '{asset}'. "
        f"The highest severity was {highest_severity}. "
        f"The asset criticality is {asset_criticality}/5. "
        f"The calculated risk score is {risk_score}/100. "
        f"MITRE ATT&CK mapping: {mitre_text}. "
        f"Human analyst review is recommended."
    )


# ============================================================
# RECOMMENDED ACTIONS
# ============================================================

def recommended_actions(
    alerts: List[Alert]
) -> List[str]:

    text = " ".join(
        f"{alert.rule_name} {alert.description}"
        for alert in alerts
    ).lower()

    actions = []

    if "brute force" in text:
        actions.append(
            "Check authentication logs and investigate the source IP."
        )

    if "password" in text:
        actions.append(
            "Review authentication activity and investigate "
            "potential credential attacks."
        )

    if "phishing" in text:
        actions.append(
            "Inspect suspicious emails, URLs, and attachments."
        )

    if "powershell" in text:
        actions.append(
            "Review PowerShell logs and investigate executed commands."
        )

    if "malware" in text:
        actions.append(
            "Perform endpoint investigation and isolate the endpoint if required."
        )

    if "ransomware" in text:
        actions.append(
            "Immediately investigate affected endpoints and network shares."
        )

    if "credential" in text:
        actions.append(
            "Investigate credential access and consider resetting affected credentials."
        )

    if "rdp" in text or "remote desktop" in text:
        actions.append(
            "Review RDP authentication logs and verify whether the connection was authorized."
        )

    actions.append(
        "Final containment or closure requires analyst approval."
    )

    return actions


# ============================================================
# CREATE INCIDENT
# ============================================================

def create_incident(
    alerts: List[Alert],
    number: int
) -> dict:

    risk = calculate_risk(alerts)

    techniques = []

    for alert in alerts:

        technique = detect_mitre(alert)

        if technique and technique not in techniques:
            techniques.append(technique)

    return {
        "incident_id": f"INC-{number:05d}",
        "alert_count": len(alerts),
        "alert_ids": [
            alert.alert_id
            for alert in alerts
        ],
        "asset": alerts[0].asset,
        "asset_criticality": max(
            alert.asset_criticality
            for alert in alerts
        ),
        "risk_score": risk,
        "priority": get_priority(risk),
        "mitre_attack": techniques,
        "summary": generate_summary(
            alerts,
            risk
        ),
        "recommended_actions": recommended_actions(
            alerts
        )
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "online",
        "service": "Security Alert Summarizer",
        "version": "1.0.0"
    }


# ============================================================
# ANALYZE ALERTS
# ============================================================

@app.post("/api/v1/analyze")
def analyze_alerts(
    request: AlertRequest
):

    if not request.alerts:
        raise HTTPException(
            status_code=400,
            detail="No alerts provided."
        )

    grouped_alerts = group_alerts(
        request.alerts
    )

    incidents = []

    for index, group in enumerate(
        grouped_alerts,
        start=1
    ):

        incidents.append(
            create_incident(
                group,
                index
            )
        )

    incidents.sort(
        key=lambda incident: incident["risk_score"],
        reverse=True
    )

    return {
        "success": True,
        "total_alerts": len(request.alerts),
        "total_incidents": len(incidents),
        "incidents": incidents
    }


# ============================================================
# UPLOAD CSV / JSON
# ============================================================

@app.post("/api/v1/upload")
async def upload_alert_file(
    file: UploadFile = File(...)
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required."
        )

    filename = file.filename.lower()

    if not (
        filename.endswith(".json")
        or filename.endswith(".csv")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only JSON and CSV files are supported."
        )

    try:

        content = await file.read()

        # JSON FILE
        if filename.endswith(".json"):

            data = json.loads(
                content.decode("utf-8")
            )

            if isinstance(data, dict):
                data = data.get(
                    "alerts",
                    []
                )

        # CSV FILE
        else:

            text = content.decode(
                "utf-8-sig"
            )

            reader = csv.DictReader(
                io.StringIO(text)
            )

            data = list(reader)

        if not isinstance(data, list):
            raise HTTPException(
                status_code=400,
                detail="File must contain a list of alerts."
            )

        if not data:
            raise HTTPException(
                status_code=400,
                detail="No alerts found in the file."
            )

        alerts = [
            Alert(**item)
            for item in data
        ]

        analysis = analyze_alerts(
            AlertRequest(
                alerts=alerts
            )
        )

        return {
            "success": True,
            "filename": file.filename,
            "analysis": analysis
        }

    except HTTPException:
        raise

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON file."
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 encoded."
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file: {str(error)}"
        )


# ============================================================
# GENERATE SYNTHETIC ALERTS
# ============================================================

@app.post("/api/v1/generate")
def generate_alerts(
    count: int = 100
):

    if count < 1 or count > 3000:
        raise HTTPException(
            status_code=400,
            detail="Count must be between 1 and 3000."
        )

    templates = [
        (
            "Brute Force Login",
            "high",
            "Multiple failed login attempts.",
            "T1110"
        ),
        (
            "Suspicious PowerShell Login",
            "critical",
            "Encoded PowerShell command detected.",
            "T1059.001"
        ),
        (
            "Phishing Email Detected",
            "medium",
            "User reported a suspicious email.",
            "T1566"
        ),
        (
            "Malware Detected on Endpoint",
            "high",
            "Antivirus detected malware on the endpoint.",
            "T1204.002"
        ),
        (
            "Ransomware Activity Detected",
            "critical",
            "Ransomware behavior detected on the system.",
            "T1486"
        ),
        (
            "Suspicious RDP Connection",
            "medium",
            "Multiple failed RDP login attempts.",
            "T1021.001"
        ),
        (
            "Credential Dumping Attempt",
            "high",
            "Attempt to dump credentials from memory.",
            "T1003"
        ),
        (
            "Process Injection Detected",
            "high",
            "Suspicious process injection activity detected.",
            "T1055"
        )
    ]

    alerts = []

    for i in range(count):

        rule, severity, description, mitre = (
            templates[i % len(templates)]
        )

        alert = Alert(
            alert_id=f"ALT-{i + 1:06d}",

            timestamp=datetime.now(
                timezone.utc
            ).isoformat(),

            source="Synthetic-SIEM",

            rule_name=rule,

            severity=severity,

            asset=f"Asset-{(i % 20) + 1}",

            asset_criticality=(
                5 if i % 10 == 0 else 3
            ),

            user=f"user{(i % 50) + 1}",

            src_ip=f"10.0.0.{(i % 100) + 1}",

            description=description,

            mitre_technique=mitre
        )

        alerts.append(alert)

    analysis = analyze_alerts(
        AlertRequest(
            alerts=alerts
        )
    )

    return {
        "success": True,
        "generated_alerts": count,
        "analysis": analysis
    }


# ============================================================
# METRICS
# ============================================================

@app.get("/api/v1/metrics")
def metrics():

    return {
        "metrics": {
            "mean_time_to_triage":
                "Track analyst start/end time",

            "alerts_per_incident":
                "Total alerts / total incidents",

            "false_positive_rate":
                "False positives / total alerts",

            "critical_incidents":
                "Number of P1 incidents",

            "analyst_review_rate":
                "Incidents reviewed by human analyst"
        }
    }


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False
    )
