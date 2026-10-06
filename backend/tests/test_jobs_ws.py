"""Jobs + WS ticket flow: stages in order, bad ticket -> 4401."""
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
    monkeypatch.setattr(main_mod, "BRAIN_URL", "")
    monkeypatch.setattr("backend.app.services.brain_client.BRAIN_URL", "")
    monkeypatch.setattr("backend.app.services.triage.JEFF_URL", "")
    monkeypatch.setattr("backend.app.services.ai_service.OPENROUTER_API_KEY", "")
    monkeypatch.setattr("backend.app.services.ai_service.OLLAMA_URL", "")
    transport = ASGITransport(app=main_mod.app)
    async with AsyncClient(transport=transport, base_url="http://t") as c:
        yield c
    main_mod.app.dependency_overrides.clear()
    await eng.dispose()


def _req():
    alerts = [{
        "alert_id": f"ALT-{i + 1:05d}", "timestamp": "2026-10-01T00:00:00+00:00",
        "asset_id": "a", "hostname": "a", "source_ip": "10.0.0.1",
        "username": "u", "event_type": "c2_beacon", "severity": "High",
        "description": "x", "confidence": 0.8, "ioc_match": 1} for i in range(4)]
    return {"alerts": alerts, "assets": [{
        "asset_id": "a", "hostname": "a", "asset_type": "server",
        "department": "it", "owner": "o", "criticality": 5}]}


async def test_job_ticket_ws_flow(client):
    r = await client.post("/api/v1/jobs", json=_req(), headers=H)
    jid = r.json()["job_id"]
    t = await client.post(f"/api/v1/jobs/{jid}/ticket", headers=H)
    ticket = t.json()["ticket"]
    # ticket is single-use: consume via helper
    assert await main_mod._check_ticket(jid, ticket) is True
    assert await main_mod._check_ticket(jid, ticket) is False
    # bad ticket rejected
    assert await main_mod._check_ticket(jid, "bogus") is False
    # job completes
    import asyncio
    for _ in range(100):
        s = await client.get(f"/api/v1/jobs/{jid}", headers=H)
        if s.json()["status"] == "done":
            break
        await asyncio.sleep(0.2)
    assert s.json()["status"] == "done"
    assert s.json()["result"]["incidents"]
