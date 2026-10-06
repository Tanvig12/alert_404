"""Brain models: SeqLSTM (DeepLog-style) + TeleAE (numeric autoencoder).

torch import is lazy so `pytest brain/tests` shape tests can run without torch
installed — but train.py / app.py require it.
"""
VOCAB_SIZE = 14  # 12 known event types + <unk> + <pad>
EMB_DIM = 32
HIDDEN_DIM = 64
NUMERIC_DIM = 6
LATENT_DIM = 8

EVENT_VOCAB = [
    "brute_force", "lateral_movement", "powershell_execution", "lsass_dump",
    "phishing_click", "privilege_escalation", "ransomware_encryption",
    "c2_beacon", "data_exfiltration", "valid_account_login",
    "external_exploit", "vpn_anomaly",
]
UNK_ID = 12
PAD_ID = 13


def event_id(event_type: str) -> int:
    try:
        return EVENT_VOCAB.index(event_type)
    except ValueError:
        return UNK_ID


def build_models():
    import torch
    import torch.nn as nn

    class SeqLSTM(nn.Module):
        def __init__(self, vocab=VOCAB_SIZE, emb=EMB_DIM,
                     hidden=HIDDEN_DIM, layers=1):
            super().__init__()
            self.emb = nn.Embedding(vocab, emb, padding_idx=PAD_ID)
            self.lstm = nn.LSTM(emb, hidden, num_layers=layers,
                                batch_first=True)
            self.head = nn.Linear(hidden, vocab)

        def forward(self, x):
            e = self.emb(x)
            o, _ = self.lstm(e)
            return self.head(o)

    class TeleAE(nn.Module):
        def __init__(self, input_dim=NUMERIC_DIM, latent=LATENT_DIM):
            super().__init__()
            self.enc = nn.Sequential(nn.Linear(input_dim, 16), nn.ReLU(),
                                     nn.Linear(16, latent), nn.ReLU())
            self.dec = nn.Sequential(nn.Linear(latent, 16), nn.ReLU(),
                                     nn.Linear(16, input_dim))

        def forward(self, x):
            return self.dec(self.enc(x))

    return SeqLSTM(), TeleAE()


def lstm_surprise(probs: list[float], actual_id: int) -> float:
    """round(100*(1 - p(actual | prefix)),1), clamped 0-100."""
    p = probs[actual_id] if 0 <= actual_id < len(probs) else 0.0
    return round(max(0.0, min(100.0, 100.0 * (1.0 - p))), 1)


def ae_error(mse: float, p50: float, p95: float) -> float:
    """min-max normalized MSE against calibration, clipped 0-100."""
    if p95 <= p50:
        return 50.0
    return round(max(0.0, min(100.0, 100.0 * (mse - p50) / (p95 - p50))), 1)
