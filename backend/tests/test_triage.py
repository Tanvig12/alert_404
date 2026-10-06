"""Triage: jeff fixture -> source jeff; down -> None; low conf -> needs_review."""
import httpx

from backend.app.services import triage as triage_mod
from backend.app.services.triage import triage_incident


def _client_for(payload: dict, real=None) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload, request=request)
    cls = real or httpx.AsyncClient
    return cls(transport=httpx.MockTransport(handler))


async def test_jeff_parsed(monkeypatch):
    real = httpx.AsyncClient
    payload = {"answers": [
        {"score": 0.9}, {"value": "true_positive"}, {"score": 0.8}]}
    monkeypatch.setattr(triage_mod, "JEFF_URL", "http://jeff-test")
    monkeypatch.setattr(httpx, "AsyncClient",
                        lambda **kw: _client_for(payload, real))
    d = await triage_incident("headline", ["e1"], "P1")
    assert d["source"] == "jeff"
    assert d["disposition"] == "true_positive"
    assert d["cost"] == 0.0


async def test_jeff_down_gives_none(monkeypatch):
    monkeypatch.setattr(triage_mod, "JEFF_URL", "http://127.0.0.1:9")
    d = await triage_incident("headline", ["e1"], "P1")
    assert d is None


async def test_low_confidence_forces_review(monkeypatch):
    real = httpx.AsyncClient
    payload = {"answers": [
        {"score": 0.9}, {"value": "benign"}, {"score": 0.3}]}
    monkeypatch.setattr(triage_mod, "JEFF_URL", "http://jeff-test")
    monkeypatch.setattr(httpx, "AsyncClient",
                        lambda **kw: _client_for(payload, real))
    d = await triage_incident("headline", ["e1"], "P1")
    assert d["disposition"] == "needs_review"


async def test_empty_url_gives_none(monkeypatch):
    monkeypatch.setattr(triage_mod, "JEFF_URL", "")
    assert await triage_incident("h", ["e"], "P1") is None


def test_no_paid_jev_call_anywhere():
    import pathlib
    hits = [str(p) for p in pathlib.Path("backend").rglob("*.py")
            if "api/alpha/decisions" in p.read_text()]
    assert hits == []
