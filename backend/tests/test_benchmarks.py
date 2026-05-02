"""End-to-end benchmark tests using the sample fixtures."""

from __future__ import annotations

from pathlib import Path

from app.benchmarks import evaluate
from app.models import Device
from app.models.device import DeviceService, OpenPort
from app.parsers import parse_aws_security_group, parse_cisco_ios, parse_iptables_save


def _outcomes(results: list, check_id: str) -> list[str]:
    return [r.outcome for r in results if r.check_id == check_id]


def test_permissive_fixtures_fail_expected_checks(samples_dir: Path) -> None:
    rulesets = [
        parse_iptables_save((samples_dir / "iptables" / "permissive.rules").read_text(),
                            owner_ip="10.0.0.1"),
        parse_aws_security_group((samples_dir / "aws-sg" / "wide-open.json").read_text()),
        parse_cisco_ios((samples_dir / "cisco" / "legacy-edge.cfg").read_text()),
    ]
    devices = [
        Device(
            ip="10.0.0.1",
            hostname="legacy-host",
            open_ports=[
                OpenPort(port=23, service=DeviceService(name="telnet", banner="Telnet ready.")),
                OpenPort(port=22, service=DeviceService(name="ssh", banner="OpenSSH_5.3")),
            ],
        )
    ]
    results = evaluate(devices, rulesets)

    # The permissive fixtures should fail every check that they're applicable to.
    # (CIS-NET-007 passes here because the iptables fixture has the stateful rule —
    # it's permissive but still uses connection tracking.)
    for check_id in ("CIS-NET-001", "CIS-NET-002", "CIS-NET-003", "CIS-NET-004",
                     "CIS-NET-005", "CIS-NET-006", "CIS-NET-008"):
        assert "fail" in _outcomes(results, check_id), \
            f"{check_id} should fail on permissive fixtures"


def test_hardened_fixtures_pass_most(samples_dir: Path) -> None:
    rulesets = [
        parse_iptables_save((samples_dir / "iptables" / "hardened.rules").read_text(),
                            owner_ip="10.0.0.2"),
        parse_aws_security_group((samples_dir / "aws-sg" / "restrictive.json").read_text()),
        parse_cisco_ios((samples_dir / "cisco" / "hardened-edge.cfg").read_text()),
    ]
    devices = [
        Device(ip="10.0.0.2", hostname="bastion",
               open_ports=[OpenPort(port=22, service=DeviceService(name="ssh",
                                                                    banner="OpenSSH_9.6"))])
    ]
    results = evaluate(devices, rulesets)

    # Critical checks must pass on the hardened fixtures.
    for cid in ("CIS-NET-001", "CIS-NET-002", "CIS-NET-003", "CIS-NET-004"):
        assert "fail" not in _outcomes(results, cid), f"{cid} unexpectedly failed"
