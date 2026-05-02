"""Recurring scan schedules — a small persisted resource the dashboard CRUDs."""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class Schedule(BaseModel):
    schedule_id: str
    name: str = Field(..., min_length=1, max_length=80,
                      description="Human label, e.g. 'Production VPC nightly'.")
    targets: list[str] = Field(..., min_length=1, max_length=16)
    sample_ids: list[str] = Field(default_factory=list)
    allow_public: bool = False

    interval_minutes: int = Field(
        ..., ge=15,
        description="How often to fire, in minutes. Minimum 15 to avoid runaway loops.",
    )
    enabled: bool = True

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_run_at: datetime | None = None
    next_run_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    last_scan_id: str | None = None
    last_status: str | None = Field(
        default=None,
        description="'ok' on success, or 'error: <message>' on failure.",
    )

    @property
    def id(self) -> str:
        return self.schedule_id
