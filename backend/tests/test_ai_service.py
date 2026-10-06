"""AI service: rules fallback, bad-JSON handling, evidence subset, :free IDs."""

from backend.app.services import ai_service
from backend.app.services.ai_service import generate_brief, rules_brief


def _incident():
    return {"id": "INC-0001", "asset_id": "dc-01", "risk_score": 92.0,
            "severity": "P1", "alert_count": 3,
            "primary_technique": "T1003.001"}


class _A:
    def __init__(self, i):
        self.alert_id = f"ALT-{i:05d}"
        self.event_type = "lsass_dump"
        self.hostname = "dc-01"
        self.source_ip = "1.2.3.4"
        self.username = "jdoe"
        self.severity = "Critical"
        self.description = "lsass_dump on dc-01"
        self.confidence = 0.9


async def test_no_key_gives_rules():
    ai_service.OPENROUTER_API_KEY = ""
    ai_service.OLLAMA_URL = ""
    b = await generate_brief(_incident(), [_A(1), _A(2)], [], {})
    assert b["provider"] == "rules"
    assert b["fallback_used"] is True


async def test_parse_bad_json_returns_none():
    assert ai_service._parse("not json at all", {"ALT-00001"}) is None
    assert ai_service._parse('{"no_evidence": 1}', {"ALT-00001"}) is None


async def test_evidence_subset_enforced():
    parsed = ai_service._parse(
        '{"key_evidence": [{"alert_id": "ALT-00001"}, '
        '{"alert_id": "ALT-99999"}, "ALT-00002"], "x": 1}',
        {"ALT-00001", "ALT-00002"})
    ids = {e["alert_id"] for e in parsed["key_evidence"]}
    assert ids <= {"ALT-00001", "ALT-00002"}


def test_free_model_ids_carry_suffix():
    assert ai_service.OPENROUTER_MODEL.endswith(":free")
    for m in ai_service.OPENROUTER_FALLBACKS:
        assert m.strip().endswith(":free"), m


def test_rules_brief_shape():
    b = rules_brief(_incident(), [{"alert_id": "ALT-00001",
                                   "event_type": "lsass_dump",
                                   "hostname": "dc-01"}])
    assert b["provider"] == "rules"
    assert len(b["recommended_actions"]) >= 3
