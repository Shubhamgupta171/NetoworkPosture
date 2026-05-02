from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from nps_scanner.firewall import load_firewall  # noqa: E402

SAMPLES = Path(__file__).resolve().parents[2] / "samples"


@pytest.mark.parametrize(
    ("source", "file_name"),
    [
        ("iptables", "iptables/permissive.rules"),
        ("iptables", "iptables/hardened.rules"),
        ("aws-sg", "aws-sg/wide-open.json"),
        ("aws-sg", "aws-sg/restrictive.json"),
        ("cisco-ios", "cisco/legacy-edge.cfg"),
        ("cisco-ios", "cisco/hardened-edge.cfg"),
    ],
)
def test_load_firewall_round_trips(source: str, file_name: str) -> None:
    rs = load_firewall(source, SAMPLES / file_name)  # type: ignore[arg-type]
    assert rs.source_type == source
    assert rs.rules, f"Expected at least one rule from {file_name}"
    payload = rs.to_json()
    assert payload["source_type"] == source
    assert isinstance(payload["rules"], list)
