"""Ingestion request/response shapes."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.device import Device
from app.models.firewall import FirewallRuleSet


class IngestPayload(BaseModel):
    """What the scanner POSTs to /ingest."""

    scan_id: str = Field(default_factory=lambda: uuid4().hex)
    scanner_version: str = "0.1.0"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    devices: list[Device] = Field(default_factory=list)
    rulesets: list[FirewallRuleSet] = Field(default_factory=list)


class ScanSummary(BaseModel):
    scan_id: str
    started_at: datetime
    finished_at: datetime
    device_count: int
    ruleset_count: int
    pass_count: int
    fail_count: int


class ScanReport(ScanSummary):
    """A summary plus pointers to where to find the per-resource details."""

    devices_endpoint: str = "/devices"
    firewall_rules_endpoint: str = "/firewall-rules"
    cis_results_endpoint: str = "/cis-results"
