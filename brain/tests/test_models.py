"""Brain model shapes/ranges — torch-free pure-function parts."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (UNK_ID, VOCAB_SIZE, ae_error, event_id,
                    lstm_surprise)


def test_event_id_known_and_unknown():
    assert event_id("c2_beacon") == 7
    assert event_id("nope") == UNK_ID
    assert VOCAB_SIZE == 14


def test_surprise_range():
    probs = [0.05] * 14
    probs[3] = 0.4
    s = lstm_surprise(probs, 3)
    assert s == round(100 * (1 - 0.4), 1)
    assert 0.0 <= lstm_surprise([0.0] * 14, 0) <= 100.0


def test_ae_error_calibration():
    assert ae_error(0.5, 0.4, 0.6) == 50.0
    assert ae_error(10.0, 0.4, 0.6) == 100.0
    assert ae_error(-5.0, 0.4, 0.6) == 0.0


def test_ae_spike_exceeds_baseline():
    base = ae_error(0.42, 0.4, 0.6)
    spike = ae_error(0.59, 0.4, 0.6)
    assert spike > base
