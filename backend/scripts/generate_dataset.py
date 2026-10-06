"""Seeded synthetic SOC dataset: 3000 alerts, 60 assets, 5 campaigns.

Stdlib + faker only. `random.seed(42)` for reproducibility.
Usage: uv run python scripts/generate_dataset.py --count 3000 --seed 42
"""
import argparse
import csv
import random
from datetime import datetime, timedelta, timezone

from faker import Faker

ASSET_TYPES = ["server", "workstation", "firewall", "database", "gateway", "domain-controller"]
DEPTS = ["finance", "engineering", "hr", "it", "sales", "operations"]
EVENT_TYPES = [
    "brute_force", "lateral_movement", "powershell_execution", "lsass_dump",
    "phishing_click", "privilege_escalation", "ransomware_encryption",
    "c2_beacon", "data_exfiltration", "valid_account_login",
    "external_exploit", "vpn_anomaly",
]

# 5 scripted multi-stage campaigns on critical assets
CAMPAIGNS = {
    "CAMPAIGN-A": {
        "asset": "dc-01", "user": "jdoe",
        "chain": ["phishing_click", "powershell_execution", "lsass_dump",
                  "lateral_movement", "data_exfiltration"] + ["c2_beacon"] * 7,
        "severity": "Critical",
    },
    "CAMPAIGN-B": {
        "asset": "erp-prod-01", "user": "svc-erp",
        "chain": ["brute_force"] * 4 + ["valid_account_login",
                  "lateral_movement"] + ["c2_beacon"] * 4,
        "severity": "High",
    },
    "CAMPAIGN-C": {
        "asset": "vpn-gw-01", "user": "remote-user-7",
        "chain": ["vpn_anomaly", "privilege_escalation"] + ["c2_beacon"] * 6,
        "severity": "High",
    },
    "CAMPAIGN-D": {
        "asset": "db-finance-01", "user": "dbadmin",
        "chain": ["external_exploit", "privilege_escalation",
                  "ransomware_encryption"] + ["c2_beacon"] * 6,
        "severity": "Critical",
    },
    "CAMPAIGN-E": {
        "asset": "ad-01", "user": "insider-3",
        "chain": ["valid_account_login", "data_exfiltration"] + ["c2_beacon"] * 6,
        "severity": "High",
    },
}

CRITICAL_ASSETS = [
    ("dc-01", "dc-01", 5), ("erp-prod-01", "erp-prod-01", 5),
    ("vpn-gw-01", "vpn-gw-01", 5), ("db-finance-01", "db-finance-01", 5),
    ("ad-01", "ad-01", 5),
]

HEADER = ["alert_id", "timestamp", "asset_id", "hostname", "source_ip",
          "username", "event_type", "severity", "description",
          "confidence", "ioc_match", "ground_truth_incident_id"]


def build_assets(fake: Faker) -> list[dict]:
    assets = []
    for asset_id, hostname, crit in CRITICAL_ASSETS:
        assets.append({"asset_id": asset_id, "hostname": hostname,
                       "asset_type": "server", "department": "it",
                       "owner": fake.name(), "criticality": crit})
    for i in range(5, 10):
        assets.append({"asset_id": f"srv-{i:02d}", "hostname": f"srv-{i:02d}",
                       "asset_type": "server", "department": random.choice(DEPTS),
                       "owner": fake.name(), "criticality": 5})
    for i in range(15):
        assets.append({"asset_id": f"app-{i:02d}", "hostname": f"app-{i:02d}",
                       "asset_type": "server", "department": random.choice(DEPTS),
                       "owner": fake.name(), "criticality": 4})
    for i in range(20):
        assets.append({"asset_id": f"wkst-{i:02d}", "hostname": f"wkst-{i:02d}",
                       "asset_type": "workstation", "department": random.choice(DEPTS),
                       "owner": fake.name(), "criticality": 3})
    for i in range(15):
        assets.append({"asset_id": f"iot-{i:02d}", "hostname": f"iot-{i:02d}",
                       "asset_type": "workstation", "department": random.choice(DEPTS),
                       "owner": fake.name(), "criticality": random.choice([1, 2])})
    return assets


def generate(count: int, seed: int, now: datetime) -> tuple[list[dict], list[dict]]:
    random.seed(seed)
    fake = Faker()
    Faker.seed(seed)
    assets = build_assets(fake)
    by_id = {a["asset_id"]: a for a in assets}
    alerts: list[dict] = []
    n = 0

    def mk(asset_id: str, event: str, sev: str, ts: datetime,
           user: str, gt: str, conf: float, ioc: int,
           ip: str | None = None) -> dict:
        nonlocal n
        n += 1
        return {
            "alert_id": f"ALT-{n:05d}", "timestamp": ts.isoformat(),
            "asset_id": asset_id, "hostname": by_id[asset_id]["hostname"],
            "source_ip": ip or fake.ipv4_public(), "username": user,
            "event_type": event, "severity": sev,
            "description": f"{event} detected on {asset_id} for user {user}",
            "confidence": round(conf, 2), "ioc_match": ioc,
            "ground_truth_incident_id": gt,
        }

    # Campaigns: tight time clusters on critical assets
    base = now - timedelta(days=3)
    for ci, (cid, c) in enumerate(CAMPAIGNS.items()):
        t0 = base + timedelta(hours=ci * 11)
        for j, ev in enumerate(c["chain"]):
            alerts.append(mk(c["asset"], ev, c["severity"],
                             t0 + timedelta(minutes=j * 25 + random.randint(0, 10)),
                             c["user"], cid,
                             conf=random.uniform(0.75, 0.98), ioc=1))
    n_campaign = len(alerts)
    # Noise singletons: ~85% of total
    sev_weights = [("Low", 45), ("Medium", 30), ("High", 18), ("Critical", 7)]
    sev_pool = [s for s, w in sev_weights for _ in range(w)]
    # Noise: bursty like real SOC telemetry (scanner sweeps, auth storms,
    # EDR flaps) — bursts group into incidents; lone singletons attach to
    # nearby bursts on the same asset. Uniform scatter would fragment into
    # ~600 groups and never compress; bursts compress to ~120-180.
    sev_pool = [s for s, w in sev_weights for _ in range(w)]
    budget = count - len(alerts)
    # 2 sweep episodes per asset; burst = one scanner/sweep episode.
    bursts: list[tuple[dict, datetime, str, str]] = []
    per_asset = 2
    for a in assets:
        for _ in range(per_asset):
            t0 = now - timedelta(days=7) + timedelta(
                seconds=random.randint(0, 7 * 24 * 3600))
            bursts.append((a, t0, fake.user_name(), fake.ipv4_public()))
    random.shuffle(bursts)
    sizes: list[int] = []
    remaining = budget
    for i in range(len(bursts)):
        left = len(bursts) - i
        lo = max(8, remaining - (left - 1) * 30)
        hi = min(30, remaining - (left - 1) * 8)
        if hi < lo:
            break
        n = random.randint(lo, hi)
        sizes.append(n)
        remaining -= n
    for (a, t0, user, ip), n in zip(bursts, sizes):
        span_min = random.randint(20, 150)
        # burst episode favors 1-2 event types (a sweep looks like itself)
        ep_types = random.sample(EVENT_TYPES, random.randint(1, 2))
        for j in range(n):
            ts = t0 + timedelta(
                seconds=random.randint(0, span_min * 60))
            sev = random.choice(sev_pool)
            alerts.append(mk(a["asset_id"], random.choice(ep_types), sev, ts,
                             user if random.random() < 0.85 else fake.user_name(),
                             "noise",
                             conf=round(random.uniform(0.2, 0.9), 2),
                             ioc=0 if random.random() < 0.9 else 1,
                             ip=ip if random.random() < 0.7 else None))
    # Leftover budget: singletons pinned near a burst window (attach) so the
    # batch stays compressible.
    while len(alerts) < count and bursts:
        a, t0, user, ip = random.choice(bursts)
        ts = t0 + timedelta(minutes=random.randint(-120, 180))
        if ts > now:
            ts = now - timedelta(minutes=random.randint(0, 60))
        sev = random.choice(sev_pool)
        alerts.append(mk(a["asset_id"], random.choice(EVENT_TYPES), sev, ts,
                         user, "noise",
                         conf=round(random.uniform(0.2, 0.9), 2),
                         ioc=0 if random.random() < 0.9 else 1))
    alerts.sort(key=lambda r: r["timestamp"])
    # Renumber alert_ids chronologically
    for i, r in enumerate(alerts, 1):
        r["alert_id"] = f"ALT-{i:05d}"
    return assets, alerts


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=3000)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out-alerts", default="data/synthetic_alerts_3000.csv")
    p.add_argument("--out-assets", default="data/assets.csv")
    args = p.parse_args()
    now = datetime.now(timezone.utc)
    assets, alerts = generate(args.count, args.seed, now)
    with open(args.out_assets, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["asset_id", "hostname", "asset_type",
                                          "department", "owner", "criticality"])
        w.writeheader()
        w.writerows(assets)
    with open(args.out_alerts, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        w.writerows(alerts)
    camps = sum(1 for r in alerts if r["ground_truth_incident_id"] != "noise")
    print(f"assets={len(assets)} alerts={len(alerts)} campaign_alerts={camps}")


if __name__ == "__main__":
    main()
