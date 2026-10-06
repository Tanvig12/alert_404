"""Brain client degradation: down/untrained/empty URL -> 50.0 DL parts."""
import httpx

from backend.app.services import brain_client
from backend.app.services.brain_client import ensemble_anomaly


class _A:
    def __init__(self, i):
        self.alert_id = f"ALT-{i:05d}"
        self.confidence = 0.8
        self.ioc_match = 1
        self.severity = "High"
        self.asset_id = "dc-01"
        self.event_type = "lsass_dump"
        from datetime import datetime, timezone
        self.timestamp = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


async def test_empty_url_degrades(monkeypatch):
    monkeypatch.setattr(brain_client, "BRAIN_URL", "")
    out = await ensemble_anomaly([_A(i) for i in range(3)], {"dc-01": 5})
    assert len(out) == 3
    assert brain_client.brain_state() == "degraded"
    # formula still computes: 0.40*iforest(50, small batch) + 0.35*50 + 0.25*50
    assert out[0] == round(0.40 * 50.0 + 0.35 * 50.0 + 0.25 * 50.0, 1)


async def test_brain_down_degrades(monkeypatch):
    monkeypatch.setattr(brain_client, "BRAIN_URL",
                        "http://127.0.0.1:9/score")
    out = await ensemble_anomaly([_A(i) for i in range(3)], {"dc-01": 5})
    assert all(isinstance(v, float) for v in out)
    assert brain_client.brain_state() == "degraded"


async def test_untrained_flag_degrades(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"scores": [], "trained": False},
                              request=request)

    real = httpx.AsyncClient

    class FakeClient:
        def __init__(self, **kw):
            self._c = real(transport=httpx.MockTransport(handler))

        async def __aenter__(self):
            return self._c

        async def __aexit__(self, *a):
            await self._c.aclose()
            return False

    monkeypatch.setattr(brain_client, "BRAIN_URL", "http://x/score")
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    out = await ensemble_anomaly([_A(i) for i in range(2)], {})
    assert len(out) == 2
    assert brain_client.brain_state() == "degraded"
