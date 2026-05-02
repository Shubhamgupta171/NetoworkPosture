"""CIS-NET-007 — Stateful firewall in use (RELATED,ESTABLISHED handling)."""

from __future__ import annotations

from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class StatefulFirewallCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-007",
        title="Stateful inspection enabled (RELATED,ESTABLISHED rule)",
        cis_reference="CIS Controls v8 — 4.5",
        severity="low",
        remediation=(
            "Add an early '-m state --state RELATED,ESTABLISHED -j ACCEPT' rule "
            "or an equivalent connection-tracking rule on the perimeter device."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for rs in rulesets:
            if rs.source_type != "iptables":
                continue
            stateful = [r for r in rs.rules if r.raw and "state RELATED,ESTABLISHED" in r.raw]
            if stateful:
                outcome, evidence = "pass", [f"Stateful rule present: {stateful[0].raw}"]
            else:
                outcome, evidence = "fail", [
                    "No 'state RELATED,ESTABLISHED' rule found — return traffic is filtered "
                    "stateless and may be silently dropped or accepted."
                ]
            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )
        return results
