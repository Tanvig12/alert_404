"""Train SeqLSTM + TeleAE on noise-baseline rows. CPU-only, <120s on laptop.

Usage: python train.py --csv ../data/synthetic_alerts_3000.csv
"""
import argparse
import csv
import json
import math
from pathlib import Path

ART = Path(__file__).parent / "artifacts"
SEV_NUM = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
import sys
sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--epochs", type=int, default=3)
    args = p.parse_args()

    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    from models import EVENT_VOCAB, UNK_ID, build_models, event_id

    rows = []
    with open(args.csv) as f:
        for r in csv.DictReader(f):
            if r["ground_truth_incident_id"] == "noise":
                rows.append(r)
    by_host: dict[str, list[dict]] = {}
    for r in rows:
        by_host.setdefault(r["asset_id"], []).append(r)
    for v in by_host.values():
        v.sort(key=lambda r: r["timestamp"])

    seqs, nums = [], []
    for _h, v in by_host.items():
        for r in v:
            ts_h = 0.0
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(r["timestamp"])
                ts_h = dt.hour + dt.minute / 60.0
            except ValueError:
                pass
            nums.append([float(r["confidence"]), float(r["ioc_match"]),
                         float(SEV_NUM.get(r["severity"], 1)),
                         3.0,
                         math.sin(2 * math.pi * ts_h / 24.0),
                         math.cos(2 * math.pi * ts_h / 24.0)])
    for _h, v in by_host.items():
        ids = [event_id(r["event_type"]) for r in v]
        for i in range(1, len(ids)):
            window = ids[max(0, i - 8):i]
            window = [13] * (8 - len(window)) + window
            seqs.append((window, ids[i]))

    lstm, ae = build_models()
    opt_l = torch.optim.Adam(lstm.parameters(), lr=1e-3)
    opt_a = torch.optim.Adam(ae.parameters(), lr=1e-3)
    ce = nn.CrossEntropyLoss()
    mse = nn.MSELoss()

    if seqs:
        X = torch.tensor([s for s, _ in seqs])
        Y = torch.tensor([y for _, y in seqs])
        dl = DataLoader(TensorDataset(X, Y), batch_size=256, shuffle=True)
        lstm.train()
        for _ in range(args.epochs):
            for xb, yb in dl:
                opt_l.zero_grad()
                logits = lstm(xb)[:, -1, :]
                loss = ce(logits, yb)
                loss.backward()
                opt_l.step()
    if nums:
        N = torch.tensor(nums)
        mean, std = N.mean(0), N.std(0) + 1e-6
        Nn = (N - mean) / std
        dl = DataLoader(TensorDataset(Nn), batch_size=256, shuffle=True)
        ae.train()
        for _ in range(args.epochs):
            for (xb,) in dl:
                opt_a.zero_grad()
                loss = mse(ae(xb), xb)
                loss.backward()
                opt_a.step()
        ae.eval()
        with torch.no_grad():
            errs = ((ae(Nn) - Nn) ** 2).mean(1).tolist()
        errs.sort()
        p50 = errs[len(errs) // 2]
        p95 = errs[int(len(errs) * 0.95)]
    else:
        p50, p95 = 0.0, 1.0

    ART.mkdir(exist_ok=True)
    torch.save(lstm.state_dict(), ART / "lstm.pt")
    torch.save(ae.state_dict(), ART / "ae.pt")
    with open(ART / "vocab.json", "w") as f:
        json.dump({"events": EVENT_VOCAB, "unk_id": UNK_ID}, f)
    with open(ART / "calib.json", "w") as f:
        json.dump({"p50": p50, "p95": p95}, f)
    print(f"trained on {len(seqs)} seqs {len(nums)} numeric p50={p50:.4f} p95={p95:.4f}")


if __name__ == "__main__":
    main()
