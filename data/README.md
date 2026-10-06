# Synthetic SOC dataset — 3000 alerts, 60 assets, 5 campaigns

Regenerate: `uv run --project backend python backend/scripts/generate_dataset.py --count 3000 --seed 42`

## Noise model (bursty, not uniform)

Real SOC telemetry arrives in episodes (scanner sweeps, auth storms, EDR
flaps), not uniformly. Noise is therefore generated as ~2 sweep bursts per
asset (8-30 alerts, 20-150 min span, 1-2 dominant event types, shared user/IP
with jitter), plus leftover singletons pinned near burst windows so the batch
stays compressible. Uniform scatter would fragment into ~600 groups; bursts
compress 3000 alerts into ~120 incidents (reduction ~93%).

## Campaign stories (ground truth, never sent to the correlator)

- **CAMPAIGN-A** (dc-01, Critical, 12 alerts): phishing_click → powershell_execution → lsass_dump (T1003.001) → lateral_movement → data_exfiltration + c2_beacon persistence.
- **CAMPAIGN-B** (erp-prod-01, High, 10 alerts): brute_force ×4 → valid_account_login → lateral_movement + c2_beacon.
- **CAMPAIGN-C** (vpn-gw-01, High, 8 alerts): vpn_anomaly → privilege_escalation + c2_beacon.
- **CAMPAIGN-D** (db-finance-01, Critical, 9 alerts): external_exploit → privilege_escalation → ransomware_encryption (T1486) + c2_beacon.
- **CAMPAIGN-E** (ad-01, High, 8 alerts): valid_account_login → data_exfiltration (insider) + c2_beacon.
- **noise** (~2953 alerts in ~120 sweep bursts): severity Low 45 / Medium 30 / High 18 / Critical 7, 90% ioc_match=0.
