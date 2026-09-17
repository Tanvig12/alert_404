from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from collections import defaultdict
from datetime import datetime
import csv
import io 
import json
app=FastAPI(
    title="Alert Summarizer API",
    description="This API provides endpoints for summarizing alerts from CSV files. It allows users to upload CSV files containing alert data and receive summarized information in response.",
    version="1.0"
)
class Alert(BaseModel):
    alert_id: str 
    timestamp: str
    source: str
    rule_name: str
    severity: str
    asset: str
    asset_criticality: int= Field(
        default=3,
        ge=1,
        le=5
    )
    user: Optional[str]=None
    src_ip: Optional[str]=None
    dst_ip: Optional[str]=None
    description: str=""
    mitre_technique: Optional[str]=None
class AlertRequest(BaseModel):
    alerts: List[Alert]
SEVERITY_SCORE={
    "low": 20,
    "medium": 40,
    "high": 70,
    "critical": 90
}
MITRE_RULES={
    "brute force": "T1110",
    "phishing": "T1566",
    "password spraying": "T1110.003",
    "powershell": "T1059.001",
    "command and scripting": "T1059",
    "spearphishing": "T1566.001",
    "malware": "T1204.002",
    "ransomware": "T1486",
    "scheduled task": "T1053.005",
    "credential dumping": "T1003",
    "process injection": "T1055",
    "remote desktop": "T1021.001",
    "rdp": "T1021.001",
    "wmi": "T1047",
    "exfiltration": "T1041",
}
def detect_mitre(alert):
    if alert.mitre_technique:
        return alert.mitre_technique
    text= (
        alert.rule_name +
        " " +
        alert.description
    ).lower()
    for keyword, technique in MITRE_RULES.items():
        if keyword in text:
            return technique
    return None
def calculate_risk(alerts):
    highest_severity= max(
        SEVERITY_SCORE.get(
            alert.severity.lower(),
            40
        )
        for alert in alerts
    )
    highest_asset_criticality= max(
        alert.asset_criticality
        for alert in alerts
    )
    alert_volume_bonus = min(
        len(alerts)*2,
        10
    )
    score = (
        highest_severity * 0.55
        +
        highest_asset_criticality * 9
        +
        alert_volume_bonus
    )
    return round(
        min(score, 100),
        2
    )
def group_alerts(alerts):
    groups = defaultdict(list)
    for alert in alerts:
        try:
            timestamp = datetime.fromisoformat(
                alert.timestamp.replace(
                    "Z",
                    "+00:00"
                )
            )
            time_bucket=int(
                timestamp.timestamp() // 1800
            )
        except Exception:
            time_bucket=0
        key=(
            alert.asset,
            alert.user or "",
            alert.src_ip or "",
            time_bucket
        )
        groups[key].append(alert)
    return list(groups.values())
def summarize_alerts(alerts, risk_score):
   asset = alerts[0].asset
   severity = max(
       alerts,
       key=lambda x: SEVERITY_SCORE.get(
              x.severity.lower(),
              40
        )
    ).severity
   techniques =[]
   for alert in alerts:
       technique=detect_mitre(alert)
       if technique and technique not in techniques:
           techniques.append(technique)
           if techniques:
               mitre_text=", ".join(techniques)
           else:
               mitre_text="NoMITRE technique detected"
               summary=(
                   f"{len(alerts)} related security alert(s)"
                   f"were detected on asset '{asset}'."
                   f"The highest severity was {severity}."
                   f"The asset criticality is"
                   f"{max(a.asset_criticality for a in alerts)}/5."
                   f"The calculated risk score is "
                   f"{risk_score}/100."
                   f"MITRE ATTACK mapping:"
                   f"{mitre_text}."
                   f"Human analyst review is recommended."
                )
               return summary
def recommended_actions(alerts):
    text = " ".join(
        (
            alert.rule_name + 
            "  " +
            alert.description
        ).lower()
        for alert in alerts
    )
    actions=[]
    if "brute force" in text:
        actions.append(
            "Check for aunthentication logs and investigate source IP."
        )
    if "password"  in text:
        actions.append(
            "Inspect email, URL and attachments information."
        )
    if "malware" in text:
        actions.append(
            "Perform endpoint investigation and isolate if required."
        )
    if "ransomware" in text:
        actions.append(
            "Immediately investigate affected endpoints and network shares."
        )
    actions.append(
        "Final containment or closure requires analyst approval."
    )
    return actions
def create_incident(alerts, number):
    risk= calculate_risk(alerts)
    techniques=[]
    for alert in alerts:
        technique=detect_mitre(alert)
        if technique and technique not in techniques:
            techniques.append(technique)
    incident={
        "incident_id":
          f"INC-{number:05d}",
        "alert_count":
          len(alerts),
        "alert_ids":
          [alert.alert_id for alert in alerts],
        "asset":
          alerts[0].asset,
        "asset_criticality":
          max(
            a.asset_criticality
            for a in alerts
            ),
        "risk_score":
            risk,
        "priority":
            get_priority(risk),
        "mitre_attack":
            techniques, 
        "summary":
            generate_summary(
                alerts, 
                risk
            ),
        "recommended_actions":
            recommended_actions(
                alerts
            )
    }
    return incident
@app.get("/health")
def health():
    return{
        "status": "online",
        "service": "Security Alert Symmarizer",
        "version": "1.0"
    }
@app.post("/api/v1/analyze")
def analyze_alerts(request: AlertRequest):
    if not request.alerts:
        raise HTTPException(
            status_code=400,
            detail="No alerts provided."
        )
    grouped_alerts= group_alerts(request.alerts)
    incidents=[]
    for index , group in enumerate(
        group ,
        start=1
    ):
        incidents.append(
            create_incident(
                group,
                index

            )
        )
    incidents.sort(
        key=lambda x: x["risk_score"],
        reverse=True
    )
    return{
        "success": True,
        "total_alerts":
            len(request.alerts),
        "total_incidents":
            len(incidents),
        "incidents":
            incidents
    }
@app.post("/api/v1/upload")
async def upload_alert_file(
    file: UploadFile = File(...)
):
    filename = file.filename.lower()
    content= await file.rad()
    try:
        if filename.endswith(".json"):
            data =json.loads(
                content.decode("utf-8")
            )
        if isinstance(data, dict):
            data = data.get(
                "alerts",
                  []
            )
        elif filename.endswith(".csv"):
            text = content.decode("utf-8")
            reader = csv.DictReader(
                io.StringIO(text)
            )
            data = list(reader)
        else:
            raise HTTPException(
                status_code=400,
                detail="Only JSON and CSV files are supported."
            )
        alerts =[
            Alert(**item)
            for item in data
        ]
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file: {error}"
        )
@app.post("/api/v1/generate")
def generate_alerts(
    count: int=100
):
    if count<=1 or count>=3000:
        raise HTTPException(
            status_code=400,
            detail= "Count must be between 1 and 3000."
        )
    alert_templates = [
        (
            "Brute Force Login",
            "high",
            "Multiple failed login attempts.",
            "T1110"
        ),
        (
            "Suspicious Powershell Login",
            "critical",
            "Encoded Powershell command detected.",
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
        ),
        (
            "Phishing Email",
            "medium",
            "Suspicious URL detected",
            "T1566.002"
        ),
        (
            "Malware Execution",
            "critical",
            "Malware executable detected.",
            "T1204.002"
        ),
        (
            "RDP Login",
            "medium",
            "Unusual Remote Desktop login",
            "T1021.001"
        )
    ]
    alerts = []
    for i in range(count):
        template = alert_templates[
            i % len(alert_templates)
        ]
        rule, severity, description, mitre = template
        alert = Alert(
            alert_id=f"ALT-{i+1:06d}",
            timestamp=
                datetime.utcnow().isoformat(),
            source=
                "Synthetic-SIEM",
            rule_name=
                rule,
            severity=
                severity,
            asset=
                f"Asset-{(i % 20) + 1}",
            asset_criticality=
                5 if i % 10 == 0 else 3,
            user=
                f"user{(i % 50) + 1}",
            src_ip=
                f"10.0.0.{(i%100)+1}",
            description=
                description,
            mitre_technique=
                mitre
        )
        alerts.append(alert)
    request = analyze_alerts(
        AlertRequest(
            alerts=alerts
        )
    )
    return{
        "generated_alerts":
            count,
        "analysis":
            result
    }
@app.get("/api/v1/metrices")
def metrics():
    return{
        "metrics":{
            "mean_time_to_triage":
                "Track analyst start/end time",
            "alerts_per_incident":
                "Total alerts / total incidents",
            "false_positive_rate":
                "False positive / total alerts",
            "critical_incidents":
            "Number of P1 incidents",
        "analyst_review_rate":
            "Incidents reviewed by human analyst"
        }
    }