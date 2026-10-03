import random
import csv
from datetime import datetime, timedelta

# =========================
# MITRE ATT&CK DATA
# =========================

techniques = [
    ("Reconnaissance", "T1595", "Active Scanning"),
    ("Initial Access", "T1566.001", "Phishing: Spearphishing Attachment"),
    ("Initial Access", "T1190", "Exploit Public-Facing Application"),
    ("Execution", "T1059.001", "PowerShell"),
    ("Execution", "T1059.003", "Windows Command Shell"),
    ("Execution", "T1204.002", "User Execution: Malicious File"),
    ("Persistence", "T1053.005", "Scheduled Task/Job"),
    ("Persistence", "T1547.001", "Registry Run Keys / Startup Folder"),
    ("Persistence", "T1136.001", "Create Account"),
    ("Privilege Escalation", "T1068", "Exploitation for Privilege Escalation"),
    ("Privilege Escalation", "T1548.002", "Bypass User Account Control"),
    ("Defense Evasion", "T1070.004", "File Deletion"),
    ("Defense Evasion", "T1562.001", "Impair Defenses"),
    ("Defense Evasion", "T1036", "Masquerading"),
    ("Credential Access", "T1003", "OS Credential Dumping"),
    ("Credential Access", "T1555.003", "Credentials from Web Browsers"),
    ("Credential Access", "T1110", "Brute Force"),
    ("Discovery", "T1087.001", "Account Discovery"),
    ("Discovery", "T1082", "System Information Discovery"),
    ("Discovery", "T1057", "Process Discovery"),
    ("Discovery", "T1049", "System Network Connections Discovery"),
    ("Lateral Movement", "T1021.001", "Remote Services: RDP"),
    ("Lateral Movement", "T1021.002", "SMB/Windows Admin Shares"),
    ("Collection", "T1005", "Data from Local System"),
    ("Collection", "T1113", "Screen Capture"),
    ("Collection", "T1114.002", "Remote Email Collection"),
    ("Command and Control", "T1071.001", "Web Protocols"),
    ("Command and Control", "T1071.004", "DNS"),
    ("Command and Control", "T1573", "Encrypted Channel"),
    ("Exfiltration", "T1041", "Exfiltration Over C2 Channel"),
    ("Impact", "T1486", "Data Encrypted for Impact"),
    ("Impact", "T1490", "Inhibit System Recovery")
]

# =========================
# ALERT SETTINGS
# =========================

severities = ["Low", "Medium", "High", "Critical"]

severity_weights = [
    0.40,   # Low
    0.35,   # Medium
    0.20,   # High
    0.05    # Critical
]

statuses = [
    "New",
    "Investigating",
    "Contained",
    "Resolved",
    "False Positive"
]

# =========================
# GENERATE ALERTS
# =========================

alerts = []

start_time = datetime.now() - timedelta(days=30)

for i in range(1, 3001):

    # Select MITRE technique
    tactic, technique_id, technique_name = random.choice(techniques)

    # Select severity
    severity = random.choices(
        severities,
        weights=severity_weights
    )[0]

    # Generate timestamp
    timestamp = start_time + timedelta(
        minutes=random.randint(0, 30 * 24 * 60)
    )

    # Generate IP addresses
    source_ip = f"192.168.{random.randint(1,254)}.{random.randint(1,254)}"
    destination_ip = f"10.0.{random.randint(1,254)}.{random.randint(1,254)}"

    # Generate host and user
    host = f"HOST-{random.randint(1,250):03d}"
    user = f"user{random.randint(1,100):03d}"

    # Detection confidence
    confidence = random.randint(60, 99)

    # Status
    status = random.choice(statuses)

    alert = {
        "Alert_ID": f"ALT-{i:06d}",
        "Timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "Severity": severity,
        "MITRE_Tactic": tactic,
        "MITRE_Technique_ID": technique_id,
        "MITRE_Technique": technique_name,
        "Alert_Name": f"{technique_name} detected",
        "Host": host,
        "User": user,
        "Source_IP": source_ip,
        "Destination_IP": destination_ip,
        "Status": status,
        "Detection_Confidence": f"{confidence}%",
        "Description": (
            f"Potential {technique_name} activity detected "
            f"and mapped to MITRE ATT&CK technique {technique_id}."
        )
    }

    alerts.append(alert)

# =========================
# SAVE TO CSV
# =========================

filename = "mitre_3000_alerts.csv"

with open(filename, "w", newline="", encoding="utf-8") as file:

    writer = csv.DictWriter(
        file,
        fieldnames=alerts[0].keys()
    )

    writer.writeheader()
    writer.writerows(alerts)

# =========================
# DISPLAY RESULTS
# =========================

print("=" * 60)
print("       MITRE ATT&CK ALERT GENERATOR")
print("=" * 60)

print(f"\nTotal alerts generated: {len(alerts)}")

print("\nSeverity Distribution:")

for severity in severities:
    count = sum(
        1 for alert in alerts
        if alert["Severity"] == severity
    )

    print(f"{severity:<10}: {count}")

print("\nMITRE ATT&CK Techniques:")
print(len(techniques))

print(f"\nFile created successfully: {filename}")

print("\nFirst 5 alerts:\n")

for alert in alerts[:5]:
    print(
        alert["Alert_ID"],
        "|",
        alert["Severity"],
        "|",
        alert["MITRE_Technique_ID"],
        "|",
        alert["MITRE_Technique"]
    )

print("\nDone!")