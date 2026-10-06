"""Fetch ATT&CK enterprise JSON once. Usage: uv run python scripts/fetch_mitre.py"""
import urllib.request
from pathlib import Path

URL = ("https://raw.githubusercontent.com/mitre-attack/attack-stix-data"
       "/master/enterprise-attack/enterprise-attack.json")
DEST = Path("backend/data/enterprise-attack.json")


def main() -> None:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {URL} ...")
    urllib.request.urlretrieve(URL, DEST)
    print(f"wrote {DEST} ({DEST.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
