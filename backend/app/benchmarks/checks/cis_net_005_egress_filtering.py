"""CIS-NET-005 — Egress traffic is filtered (default-deny outbound)."""

from __future__ import annotations

from app.benchmarks._helpers import is_world_open
from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class EgressFilteringCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-005",
        title="Egress traffic is filtered (default-deny outbound)",
        cis_reference="CIS Controls v8 — 13.10",
        severity="medium",
        remediation=(
            "Default the outbound chain / SG egress to deny-all and allow-list only "
            "the destinations the workload actually needs (DNS, syslog, package mirrors, ...)."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []

        for rs in rulesets:
            egress_rules = [r for r in rs.rules if r.direction == "egress"]
            if not egress_rules:
                # AWS SG egress is a separate list — Cisco usually has none in our fixtures.
                results.append(
                    self._result(
                        target_id=rs.id, target_kind="ruleset",
                        outcome="not_applicable",
                        evidence=[f"{rs.name} has no egress rules"],
                    )
                )
                continue

            allow_world = [
                f"{r.rule_id}: allow-all egress ({r.protocol} → {r.destination}, "
                f"port {r.port_range})"
                for r in egress_rules
                if r.action == "allow"
                and is_world_open(r.destination)
                and r.port_range == "any"
                and r.protocol in {"any", "-1"}
            ]
            has_default_deny = any(r.action == "default-deny" for r in egress_rules)

            if rs.source_type == "aws-sg":
                # SGs are implicit-deny; explicit allow-all egress to 0.0.0.0/0 is the failure.
                if allow_world:
                    outcome, evidence = "fail", allow_world
                else:
                    outcome, evidence = "pass", [
                        f"{r.rule_id}: scoped egress {r.protocol}/{r.port_range}→{r.destination}"
                        for r in egress_rules if r.action == "allow"
                    ] or [f"{rs.name} has no permissive egress"]
            else:
                if has_default_deny and not allow_world:
                    outcome, evidence = "pass", [
                        "Default OUTPUT policy is DROP",
                        *[f"Allowed: {r.raw}" for r in egress_rules if r.action == "allow"],
                    ]
                else:
                    outcome, evidence = "fail", allow_world or [
                        f"{rs.name} egress chain has no default-deny"
                    ]

            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )
        return results
