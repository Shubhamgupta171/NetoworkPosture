"""Benchmark check base classes.

A check returns a list of ``BenchmarkResult`` rows so it can produce one
result per device or ruleset. Aggregating into a single fail-with-evidence is
worse for the dashboard — analysts want to know *which* SG failed, not just
that "something" failed.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models import BenchmarkResult, Device, FirewallRuleSet
from app.models.findings import Severity


@dataclass(frozen=True)
class CheckMetadata:
    check_id: str
    title: str
    cis_reference: str
    severity: Severity
    remediation: str


class BenchmarkCheck(ABC):
    meta: CheckMetadata

    @abstractmethod
    def evaluate(
        self,
        devices: list[Device],
        rulesets: list[FirewallRuleSet],
    ) -> list[BenchmarkResult]: ...

    # ----- helpers shared by subclasses -----
    def _result(
        self,
        target_id: str,
        target_kind: str,
        outcome: str,
        evidence: list[str],
    ) -> BenchmarkResult:
        return BenchmarkResult(
            check_id=self.meta.check_id,
            title=self.meta.title,
            cis_reference=self.meta.cis_reference,
            severity=self.meta.severity,
            outcome=outcome,  # type: ignore[arg-type]
            target_kind=target_kind,  # type: ignore[arg-type]
            target_id=target_id,
            evidence=evidence,
            remediation=self.meta.remediation,
        )
