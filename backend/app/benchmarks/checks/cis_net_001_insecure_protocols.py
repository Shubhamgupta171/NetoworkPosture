"""CIS-NET-001 — No insecure management protocols exposed.

Fails if a device has Telnet/FTP/HTTP-mgmt/SNMPv1/v2c open to ingress, OR if a
firewall ruleset allows those service ports inbound.
"""

from __future__ import annotations

from app.benchmarks._helpers import INSECURE_SERVICE_PORTS, port_overlaps
from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class InsecureProtocolsCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-001",
        title="No insecure management protocols exposed",
        cis_reference="CIS Controls v8 — 4.1, 4.8",
        severity="high",
        remediation=(
            "Replace Telnet/FTP/HTTP/SNMPv1-v2c with SSH/SFTP/HTTPS/SNMPv3. "
            "Remove ingress rules permitting the legacy service ports."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []

        for device in devices:
            offending = [
                f"port {p.port}/{p.protocol} {INSECURE_SERVICE_PORTS[p.port]}"
                + (f" — banner: {p.service.banner!r}" if p.service and p.service.banner else "")
                for p in device.open_ports
                if p.port in INSECURE_SERVICE_PORTS
            ]
            outcome = "fail" if offending else "pass"
            results.append(
                self._result(
                    target_id=str(device.ip),
                    target_kind="device",
                    outcome=outcome,
                    evidence=offending or [f"No insecure ports open on {device.ip}"],
                )
            )

        for rs in rulesets:
            offending = []
            for r in rs.rules:
                if r.direction != "ingress" or r.action != "allow":
                    continue
                # SNMP community declarations are evaluated by CIS-NET-003.
                if r.rule_id.startswith("snmp-community-"):
                    continue
                # A rule with port_range "any" is too broad to attribute to a
                # specific insecure protocol (loopback / stateful rules look like
                # this); we only flag rules that specifically target the port.
                if r.port_range == "any":
                    continue
                for port in INSECURE_SERVICE_PORTS:
                    if port_overlaps(r.port_range, port):
                        offending.append(
                            f"{r.rule_id}: allows {INSECURE_SERVICE_PORTS[port]} "
                            f"from {r.source} → {r.raw or ''}"
                        )
                        break
            outcome = "fail" if offending else "pass"
            results.append(
                self._result(
                    target_id=rs.id,
                    target_kind="ruleset",
                    outcome=outcome,
                    evidence=offending or [f"{rs.name} permits no legacy mgmt protocols"],
                )
            )

        return results
