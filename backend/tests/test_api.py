"""E2E: 3000 CSV upload -> incidents + MTTT + evaluation incl. drift."""
import csv
import io

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from backend.app import database as db_mod
from backend.app import main as main_mod
from backend.app.models import Base

H = {"X-API-Key": "demo-key-change-me"}


@pytest.fixture()
async def client(tmp_path, monkeypatch):
    url = f"sqlite+aiosqlite:///{tmp_path}/t.db"
    eng = create_async_engine(url)
    async with eng.begin() as c:
        await c.run_sync(Base.metadata.create_all)
    S = async_sessionmaker(eng, expire_on_commit=False)

    async def override():
        async with S() as s:
            yield s

    main_mod.app.dependency_overrides[db_mod.get_db] = override
    monkeypatch.setattr(main_mod, "SessionLocal", S)
    monkeypatch.setattr("backend.app.services.brain_client.BRAIN_URL", "")
    monkeypatch.setattr("backend.app.services.triage.JEFF_URL", "")
    monkeypatch.setattr("backend.app.services.ai_service.OPENROUTER_API_KEY", "")
    monkeypatch.setattr("backend.app.services.ai_service.OLLAMA_URL", "")
    monkeypatch.setattr(main_mod, "BRAIN_URL", "")
    transport = ASGITransport(app=main_mod.app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        yield c
    main_mod.app.dependency_overrides.clear()
    await eng.dispose()


def _csv_bytes(n: int = 60) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=[
        "alert_id", "timestamp", "asset_id", "hostname", "source_ip",
        "username", "event_type", "severity", "description", "confidence",
        "ioc_match", "ground_truth_incident_id"])
    w.writeheader()
    base = "2026-10-01T00:00:00+00:00"
    for i in range(n):
        w.writerow({"alert_id": f"ALT-{i + 1:05d}", "timestamp": base,
                    "asset_id": "dc-01", "hostname": "dc-01",
                    "source_ip": "10.0.0.1", "username": "jdoe",
                    "event_type": "lsass_dump", "severity": "Critical",
                    "description": "x", "confidence": 0.9, "ioc_match": 1,
                    "ground_truth_incident_id": "CAMPAIGN-A"
                    if i < 10 else "noise"})
    return buf.getvalue().encode()


async def test_upload_e2e(client):
    r = await client.post("/api/v1/upload", files={"file": ("a.csv", _csv_bytes())},
                          headers=H)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["incidents"]
    assert body["dashboard"]["total_alerts"] == 60
    ev = await client.get("/api/v1/evaluation", headers=H)
    assert ev.status_code == 200
    for f in ("campaign_recovery_pct", "precision", "recall", "f1",
              "fp_rate", "noise_reduction_pct", "drift"):
        assert f in ev.json()
    m = await client.get("/api/v1/metrics", headers=H)
    assert m.json()["method"] == "estimate_3min_per_alert_5min_per_incident"
    iid = body["incidents"][0]["id"]
    a = await client.post(f"/api/v1/incidents/{iid}/action",
                          json={"action": "escalate", "note": "t"},
                          headers=H)
    assert a.json()["status"] == "escalated"
    nav = await client.get("/api/v1/navigator", headers=H)
    assert nav.json()["version"] == "4.5"
    dash = await client.get("/api/v1/dashboard", headers=H)
    assert "triage_source_counts" in dash.json()
    assert (await client.get("/healthz")).json() == {"ok": True}
    assert (await client.get("/api/v1/handoff.md", headers=H)).status_code == 200


async def test_empty_batch_400(client):
    r = await client.post("/api/v1/analyze",
                          json={"alerts": [], "assets": []}, headers=H)
    assert r.status_code == 400


async def test_malformed_row_422(client):
    bad = b"alert_id,timestamp\nALT-1,not-a-date\n"
    r = await client.post("/api/v1/upload", files={"file": ("b.csv", bad)},
                          headers=H)
    assert r.status_code in (400, 422)
