"""Risk scoring invariants."""
from backend.app.services.risk_scoring import alert_risk, to_priority


def test_crit5_triple_beats_20x_low():
    crit_scores = [alert_risk("Critical", 5, 0.9, 1, 80.0)[0]] * 3
    low_scores = [alert_risk("Low", 1, 0.3, 0, 20.0)[0]] * 20
    assert min(crit_scores) > max(low_scores)
    assert to_priority(max(crit_scores)) == "P1"
    assert to_priority(max(low_scores)) == "P4"


def test_suppressed_gets_03_factor():
    full, _ = alert_risk("High", 5, 0.9, 1, 70.0)
    sup, parts = alert_risk("High", 5, 0.9, 1, 70.0, suppressed=True)
    assert sup == round(full * 0.3, 1)
    assert parts["suppressed"] is True


def test_priority_bands():
    assert to_priority(80) == "P1"
    assert to_priority(79.9) == "P2"
    assert to_priority(60) == "P2"
    assert to_priority(40) == "P3"
    assert to_priority(39.9) == "P4"
