"""CIS-NET-006 — Logging / syslog is enabled and points at a remote collector."""

from __future__ import annotations

from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet


class RemoteLoggingCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-006",
        title="Logging is enabled and pointed at a remote collector",
        cis_reference="CIS Controls v8 — 8.2, 8.5",
        severity="medium",
        remediation=(
            "On Cisco IOS: 'logging host <syslog-ip>' and 'logging trap informational'. "
            "On Linux: ensure rsyslog forwards to a central collector. "
            "On AWS: enable VPC Flow Logs and CloudWatch shipping for the SG's VPC."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for rs in rulesets:
            if rs.source_type == "cisco-ios":
                logging_enabled = rs.metadata.get("logging_enabled") == "true"
                logging_host = rs.metadata.get("logging_host")
                if logging_enabled and logging_host:
                    outcome, evidence = "pass", [f"Forwarding to syslog host {logging_host}"]
                elif logging_enabled:
                    outcome, evidence = "fail", ["Logging is on but no remote host configured"]
                else:
                    outcome, evidence = "fail", ["'no logging on' present in config"]
            elif rs.source_type == "aws-sg":
                # SGs themselves don't log; flag absence of VPC Flow Log tag as informational.
                has_flow_logs = rs.metadata.get("tag:FlowLogs", "").lower() in {"true", "enabled"}
                if has_flow_logs:
                    outcome, evidence = "pass", ["VPC Flow Logs tag indicates enabled"]
                else:
                    outcome, evidence = "fail", [
                        "No FlowLogs tag set on this SG — verify VPC Flow Logs are enabled."
                    ]
            else:
                outcome, evidence = "not_applicable", [
                    "Logging detection not implemented for this source type"
                ]
            results.append(
                self._result(
                    target_id=rs.id, target_kind="ruleset", outcome=outcome, evidence=evidence
                )
            )
        return results
