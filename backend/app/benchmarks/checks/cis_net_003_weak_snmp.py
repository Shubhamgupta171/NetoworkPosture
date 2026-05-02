"""CIS-NET-003 — No default/weak SNMP community strings."""

from __future__ import annotations

from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet

WEAK_COMMUNITIES = {"public", "private", "community", "snmp", "manager"}


class WeakSnmpCommunityCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-003",
        title="No default or weak SNMP community strings",
        cis_reference="CIS Cisco IOS 2.1.2",
        severity="high",
        remediation=(
            "Remove 'public'/'private' communities, prefer SNMPv3 with auth+priv, "
            "and restrict access with a named ACL."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for rs in rulesets:
            if rs.source_type != "cisco-ios":
                continue
            offending: list[str] = []
            ok: list[str] = []
            for r in rs.rules:
                if not r.rule_id.startswith("snmp-community-"):
                    continue
                community = r.rule_id.removeprefix("snmp-community-")
                if community.lower() in WEAK_COMMUNITIES:
                    offending.append(f"{r.rule_id}: weak community '{community}' — {r.raw}")
                else:
                    ok.append(f"{r.rule_id}: non-default community '{community}'")

            if offending:
                outcome, evidence = "fail", offending
            elif ok:
                outcome, evidence = "pass", ok
            else:
                outcome, evidence = "not_applicable", [f"{rs.name} declares no SNMP communities"]
            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )
        return results
