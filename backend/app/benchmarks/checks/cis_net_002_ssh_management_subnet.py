"""CIS-NET-002 — SSH ingress is restricted to a management subnet."""

from __future__ import annotations

from app.benchmarks._helpers import is_world_open, port_overlaps
from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class SshManagementSubnetCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-002",
        title="SSH access restricted to a management subnet",
        cis_reference="CIS Cisco IOS 1.1.4 / CIS Controls v8 4.4",
        severity="high",
        remediation=(
            "Limit SSH ingress to a dedicated management CIDR (e.g. 10.x bastion subnet) "
            "and apply an access-class on Cisco VTY lines."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []

        for rs in rulesets:
            # Only consider rules that *specifically* address SSH — i.e. the
            # rule names port 22 or its protocol is ssh. Catch-all rules (port
            # "any", protocol "any") are evaluated by other checks; flagging
            # them here produces noisy false-positives on loopback / state
            # rules.
            ssh_rules = [
                r for r in rs.rules
                if r.direction == "ingress" and r.action == "allow"
                and (
                    r.protocol == "ssh"
                    or (r.protocol in {"tcp", "any"} and port_overlaps(r.port_range, 22)
                        and r.port_range != "any")
                )
            ]
            offending = [
                f"{r.rule_id}: SSH allowed from {r.source} ({r.raw or ''})"
                for r in ssh_rules if is_world_open(r.source)
            ]
            if not ssh_rules:
                outcome, evidence = "not_applicable", [f"{rs.name} does not expose SSH"]
            elif offending:
                outcome, evidence = "fail", offending
            else:
                outcome, evidence = "pass", [
                    f"SSH restricted to {r.source} via {r.rule_id}" for r in ssh_rules
                ]
            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )

        return results
