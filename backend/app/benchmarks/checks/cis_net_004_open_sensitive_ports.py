"""CIS-NET-004 — No ingress 0.0.0.0/0 to sensitive ports."""

from __future__ import annotations

from app.benchmarks._helpers import SENSITIVE_PORTS, is_world_open, port_overlaps
from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class OpenSensitivePortsCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-004",
        title="No internet ingress to sensitive ports (22/23/3389/445/3306/5432)",
        cis_reference="CIS Controls v8 — 4.4",
        severity="critical",
        remediation=(
            "Replace '0.0.0.0/0' sources with a tightly scoped CIDR or VPC peering rule. "
            "Database ports should never be reachable from the public internet."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for rs in rulesets:
            offending: list[str] = []
            for r in rs.rules:
                if r.direction != "ingress" or r.action != "allow":
                    continue
                if not is_world_open(r.source):
                    continue
                # Skip catch-all rules — those are stateful/loopback policies, not
                # explicit exposures of a specific sensitive port.
                if r.port_range == "any":
                    continue
                for port, label in SENSITIVE_PORTS.items():
                    if port_overlaps(r.port_range, port):
                        offending.append(
                            f"{r.rule_id}: {label} (port {port}) open to the internet — "
                            f"{r.raw or ''}"
                        )
            outcome = "fail" if offending else "pass"
            evidence = offending or [f"{rs.name} keeps sensitive ports off the public internet"]
            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )
        return results
