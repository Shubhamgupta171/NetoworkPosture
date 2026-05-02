"""CRUD endpoints for recurring scan schedules."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.api.deps import AuthorizedRoute, store_dep
from app.models import Schedule
from app.services.discovery import MAX_TARGETS
from app.services.storage import Store

router = APIRouter(prefix="/schedules", tags=["schedules"], dependencies=[AuthorizedRoute])


class CreateScheduleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    targets: list[str] = Field(..., min_length=1, max_length=MAX_TARGETS)
    sample_ids: list[str] = Field(default_factory=list)
    allow_public: bool = False
    interval_minutes: int = Field(..., ge=15, le=10080,
                                  description="15 min to 7 days, inclusive.")
    enabled: bool = True
    fire_immediately: bool = Field(
        default=False,
        description="If true, schedule next run for now so the first scan fires within 30s.",
    )


class UpdateScheduleRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    targets: list[str] | None = Field(default=None, min_length=1, max_length=MAX_TARGETS)
    sample_ids: list[str] | None = None
    allow_public: bool | None = None
    interval_minutes: int | None = Field(default=None, ge=15, le=10080)
    enabled: bool | None = None


@router.get("", response_model=list[Schedule])
async def list_schedules(store: Store = Depends(store_dep)) -> list[Schedule]:
    return sorted(store.list_schedules(), key=lambda s: s.created_at, reverse=True)


@router.post("", response_model=Schedule, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    req: CreateScheduleRequest, store: Store = Depends(store_dep),
) -> Schedule:
    now = datetime.now(timezone.utc)
    next_run = now if req.fire_immediately else now + timedelta(minutes=req.interval_minutes)
    schedule = Schedule(
        schedule_id=uuid4().hex,
        name=req.name,
        targets=req.targets,
        sample_ids=req.sample_ids,
        allow_public=req.allow_public,
        interval_minutes=req.interval_minutes,
        enabled=req.enabled,
        created_at=now,
        next_run_at=next_run,
    )
    store.upsert_schedule(schedule)
    return schedule


@router.patch("/{schedule_id}", response_model=Schedule)
async def update_schedule(
    schedule_id: str, req: UpdateScheduleRequest, store: Store = Depends(store_dep),
) -> Schedule:
    existing = next((s for s in store.list_schedules() if s.schedule_id == schedule_id), None)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No schedule with id={schedule_id}")
    updates = req.model_dump(exclude_none=True)
    updated = existing.model_copy(update=updates)
    store.upsert_schedule(updated)
    return updated


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT,
               response_class=Response)
async def delete_schedule(schedule_id: str, store: Store = Depends(store_dep)) -> Response:
    if not store.delete_schedule(schedule_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No schedule with id={schedule_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
