"""Correlator client: Rust 500/timeout -> None (mirror used)."""
import httpx

from backend.app.services import correlator_client
from backend.app.services.correlator_client import correlate_via_rust


class _A:
    def __init__(self, i):
        self.alert_id = f"ALT-{i:05d}"
        from datetime import datetime, timezone
        self.timestamp = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
        self.asset_id = "a"
        self.source_ip = "1.1.1.1"
        self.username = "u"


async def test_timeout_returns_none(monkeypatch):
    monkeypatch.setattr(correlator_client, "CORRELATOR_URL",
                        "http://127.0.0.1:9/correlate")
    assert await correlate_via_rust([_A(1)], {}) is None


async def test_500_returns_none(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={}, request=request)

    real = httpx.AsyncClient

    class FakeClient:
        def __init__(self, **kw):
            self._c = real(transport=httpx.MockTransport(handler))

        async def __aenter__(self):
            return self._c

        async def __aexit__(self, *a):
            await self._c.aclose()
            return False

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    assert await correlate_via_rust([_A(1)], {}) is None


async def test_mirror_matches_rust_grouping():
    from backend.app.services.correlation import correlate as mirror
    dicts = [
        {"alert_id": "A1", "timestamp": "2026-10-01T00:00:00+00:00",
         "asset_id": "a", "source_ip": "1.1.1.1", "username": "u"},
        {"alert_id": "A2", "timestamp": "2026-10-01T01:00:00+00:00",
         "asset_id": "a", "source_ip": "1.1.1.1", "username": "u"},
        {"alert_id": "A3", "timestamp": "2026-10-01T10:00:00+00:00",
         "asset_id": "a", "source_ip": "9.9.9.9", "username": "v"},
    ]
    tactics = {"A1": "TA0001", "A2": "TA0001", "A3": "TA0002"}
    groups = mirror(dicts, tactics)
    assert len(groups) == 2
    assert {d["alert_id"] for d in groups[0]} | {d["alert_id"] for d in groups[1]} == {
        "A1", "A2", "A3"}
