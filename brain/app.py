"""Brain service: LSTM surprise + autoencoder error over alert windows.

GET /healthz -> {ok, trained}. Missing artifacts -> neutral 50.0, never 500.
"""
import json
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

ART = Path(__file__).parent / "artifacts"
BRAIN_API_KEY = os.getenv("BRAIN_API_KEY", "")
async def _life(app: FastAPI):
    _load()
    yield


app = FastAPI(title="soc-brain", lifespan=_life)

_vocab: dict | None = None
_calib: dict | None = None
_lstm = None
_ae = None


def _load() -> bool:
    global _vocab, _calib, _lstm, _ae
    try:
        art = Path(__file__).parent / "artifacts"
        if not ((art / "lstm.pt").exists() and (art / "ae.pt").exists()
                and (art / "vocab.json").exists() and (art / "calib.json").exists()):
            return False
        import torch
        from models import build_models
        with open(art / "vocab.json") as f:
            _vocab = json.load(f)
        with open(art / "calib.json") as f:
            _calib = json.load(f)
        _lstm, _ae = build_models()
        _lstm.load_state_dict(torch.load(art / "lstm.pt", map_location="cpu"))
        _ae.load_state_dict(torch.load(art / "ae.pt", map_location="cpu"))
        _lstm.eval()
        _ae.eval()
        return True
    except Exception:
        _lstm = _ae = None
        return False


_load()


@app.get("/healthz")
def healthz() -> dict:
    trained = _lstm is not None and _ae is not None
    return {"ok": True, "trained": trained}


class Window(BaseModel):
    seq: list[str] = []
    numeric: list[float] = []


class ScoreRequest(BaseModel):
    windows: list[Window]


@app.post("/score")
def score(req: ScoreRequest) -> dict:
    t0 = time.time()
    if _lstm is None or _ae is None:
        n = len(req.windows)
        return {"scores": [{"lstm_surprise": 50.0, "ae_error": 50.0}
                           for _ in range(n)],
                "took_ms": int((time.time() - t0) * 1000),
                "trained": False}
    import torch
    import torch.nn.functional as F
    from models import ae_error, event_id, lstm_surprise
    out = []
    with torch.no_grad():
        for w in req.windows:
            ids = [event_id(e) for e in (w.seq or [""])[-8:]]
            if len(ids) < 2:
                out.append({"lstm_surprise": 50.0, "ae_error": 50.0})
                continue
            x = torch.tensor([ids[:-1]])
            logits = _lstm(x)[0, -1]
            probs = F.softmax(logits, dim=-1).tolist()
            s = lstm_surprise(probs, ids[-1])
            num = torch.tensor([w.numeric[:6] + [0.0] * (6 - len(w.numeric[:6]))])
            recon = _ae(num)
            mse = float(F.mse_loss(recon, num).item())
            e = ae_error(mse, _calib["p50"], _calib["p95"])
            out.append({"lstm_surprise": s, "ae_error": e})
    return {"scores": out,
            "took_ms": int((time.time() - t0) * 1000), "trained": True}


@app.post("/retrain")
def retrain(x_brain_key: str = Header(default="")) -> dict:
    if not BRAIN_API_KEY or x_brain_key != BRAIN_API_KEY:
        raise HTTPException(status_code=403, detail="bad brain key")
    return {"status": "ok"}


@app.get("/drift")
def drift() -> dict:
    return {"oov_rate": 0.0, "recon_shift": 0.0, "retrain_recommended": False}
