"""MITRE mapping: all 12 resolve, unknown -> None."""
from backend.app.services.mitre_mapper import (EVENT_TO_TECHNIQUE,
                                               enrich, map_alert)


def test_all_12_mappings_resolve():
    assert len(EVENT_TO_TECHNIQUE) == 12
    for event, tid in EVENT_TO_TECHNIQUE.items():
        assert map_alert(event) == tid
        assert tid.startswith("T")


def test_unknown_returns_none():
    assert map_alert("no_such_event") is None
    assert map_alert("") is None


def test_enrich_falls_back_without_file():
    out = enrich(["T1003.001", "T1486"])
    assert len(out) == 2
    assert out[0]["id"] == "T1003.001"
    assert out[0]["name"]
