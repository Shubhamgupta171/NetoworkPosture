"""Parser tests against the bundled sample fixtures."""

from __future__ import annotations

from pathlib import Path

from app.parsers import parse_aws_security_group, parse_cisco_ios, parse_iptables_save


def test_iptables_parses_permissive_fixture(samples_dir: Path) -> None:
    text = (samples_dir / "iptables" / "permissive.rules").read_text()
    rs = parse_iptables_save(text, owner_ip="10.0.0.1")
    assert rs.source_type == "iptables"
    rule_ids = [r.rule_id for r in rs.rules]
    assert "INPUT-default" in rule_ids
    # The permissive fixture allows port 23 (telnet).
    assert any(r.port_range == "23" and r.action == "allow" for r in rs.rules)


def test_iptables_marks_default_deny_for_hardened(samples_dir: Path) -> None:
    text = (samples_dir / "iptables" / "hardened.rules").read_text()
    rs = parse_iptables_save(text)
    defaults = {r.rule_id: r.action for r in rs.rules if r.rule_id.endswith("default")}
    assert defaults["OUTPUT-default"] == "default-deny"
    assert defaults["INPUT-default"] == "default-deny"


def test_aws_sg_parses_world_open(samples_dir: Path) -> None:
    text = (samples_dir / "aws-sg" / "wide-open.json").read_text()
    rs = parse_aws_security_group(text)
    assert rs.source_type == "aws-sg"
    sources = {r.source for r in rs.rules if r.direction == "ingress"}
    assert "0.0.0.0/0" in sources
    egress_anywhere = [
        r for r in rs.rules
        if r.direction == "egress" and r.destination == "0.0.0.0/0" and r.protocol == "any"
    ]
    assert egress_anywhere, "expected wide-open egress rule"


def test_cisco_extracts_snmp_and_logging(samples_dir: Path) -> None:
    text = (samples_dir / "cisco" / "legacy-edge.cfg").read_text()
    rs = parse_cisco_ios(text)
    assert rs.metadata["hostname"] == "edge-router-01"
    assert rs.metadata["logging_enabled"] == "false"
    snmp = [r for r in rs.rules if r.rule_id.startswith("snmp-community-")]
    assert {r.rule_id for r in snmp} == {"snmp-community-public", "snmp-community-private"}
    telnet_rules = [r for r in rs.rules if r.protocol == "telnet"]
    assert telnet_rules, "VTY transport telnet should produce a rule"


def test_cisco_hardened_has_acl_and_logging(samples_dir: Path) -> None:
    text = (samples_dir / "cisco" / "hardened-edge.cfg").read_text()
    rs = parse_cisco_ios(text)
    assert rs.metadata["logging_host"] == "10.10.0.50"
    assert rs.metadata.get("vty_access_class") == "MGMT-IN"
