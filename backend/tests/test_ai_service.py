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
    assert "qwen/qwen3-next" not in ai_service.OPENROUTER_MODEL
    for m in ai_service.OPENROUTER_FALLBACKS:
        assert m.strip().endswith(":free"), m


def test_reasoner_budget_exceeds_direct():
    assert (ai_service._max_tokens_for("dots-studio/dots-3-note-preview:free")
            > ai_service._max_tokens_for(
                "nvidia/nemotron-3-super-120b-a12b:free"))


def _queue():
    return {
        "counts": {"incidents": 2, "open": 2, "acknowledged": 0,
                   "escalated": 0, "false_positive": 0,
                   "P1_open": 1, "P2_open": 1},
        "top_p1": [{"id": "INC-0001", "asset_id": "db-finance-01",
                    "risk_score": 95.0, "status": "open",
                    "primary_technique": "T1071.001",
                    "headline": "P1 incident on db-finance-01",
                    "triage": None}],
        "top_p2": [{"id": "INC-0002", "asset_id": "ws-04",
                    "risk_score": 70.0, "status": "open",
                    "primary_technique": "T1003.001",
                    "headline": "P2 incident on ws-04",
                    "triage": None}],
        "technique_counts": {"T1071.001": 3},
        "uncovered_techniques": [],
        "analyst_actions": [],
        "brain_state": "degraded",
    }


async def test_summary_offline_fallback_names_real_ids():
    ai_service.OPENROUTER_API_KEY = ""
    s = await ai_service.generate_shift_summary(_queue())
    assert s["provider"] == "rules"
    assert s["fallback_used"] is True
    assert "INC-0001" in s["executive_summary"]
    assert "INC-0001" in s["now_watch"]
    assert len(s["next_shift_priorities"]) >= 1
    # honest brain reporting, not a fabricated ok
    assert "degraded" in s["signoff_notes"]


async def test_summary_rejects_invented_ids():
    parsed = ai_service._parse_summary(
        '{"executive_summary": "x", "next_shift_priorities": ["a"], '
        '"now_watch": ["INC-9999", "INC-0001"], '
        '"detection_gaps": [], "signoff_notes": "y"}',
        {"INC-0001"})
    assert parsed is not None
    assert parsed["now_watch"] == ["INC-0001"]


async def test_summary_extracts_decorated_ids():
    parsed = ai_service._parse_summary(
        '{"executive_summary": "x", "next_shift_priorities": ["a"], '
        '"now_watch": ["INC-0001 \\u2013 P1 open", "INC-9999 \\u2013 hub"], '
        '"detection_gaps": [], "signoff_notes": "y"}',
        {"INC-0001"})
    assert parsed is not None
    assert parsed["now_watch"] == ["INC-0001"]

async def test_summary_bad_json_returns_none():
    assert ai_service._parse_summary("not json", {"INC-0001"}) is None
    assert ai_service._parse_summary('{"executive_summary": 1, '
                                     '"next_shift_priorities": "x"}',
                                     {"INC-0001"}) is None


def test_rules_brief_shape():
    b = rules_brief(_incident(), [{"alert_id": "ALT-00001",
                                   "event_type": "lsass_dump",
                                   "hostname": "dc-01"}])
    assert b["provider"] == "rules"
    assert len(b["recommended_actions"]) >= 3
