"""Benchmark check results."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

CheckOutcome = Literal["pass", "fail", "not_applicable"]
Severity = Literal["info", "low", "medium", "high", "critical"]


class BenchmarkResult(BaseModel):
    check_id: str = Field(..., description="e.g. CIS-NET-001")
    title: str
    cis_reference: str
    severity: Severity
    outcome: CheckOutcome
    target_kind: Literal["device", "ruleset"] = "ruleset"
    target_id: str = Field(..., description="Device IP or ruleset id the result is about.")
    evidence: list[str] = Field(
        default_factory=list,
        description="Human-readable lines explaining the verdict (offending rules, banners).",
    )
    remediation: str | None = None
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def id(self) -> str:
        return f"{self.target_id}:{self.check_id}"
