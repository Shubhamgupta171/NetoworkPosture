"""Background scheduler that fires due :class:`Schedule` entries.

This runs as an asyncio task spawned from the FastAPI lifespan, so a single
uvicorn process handles both HTTP and the scheduler. For Lambda deployments,
swap this loop out for an EventBridge rule that invokes a small "tick" Lambda
on the same cadence — the schedule data in DynamoDB is the same shape either
way, so no client changes are needed.

Resolution: ``TICK_INTERVAL_SECONDS`` defines how often we look for due
schedules. With a 30s tick, the minimum schedule interval of 15 minutes is
honoured with ample headroom.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.models import Schedule
from app.services.discovery import TargetRejected
from app.services.orchestrator import run_in_app_scan
from app.services.storage import Store

logger = logging.getLogger(__name__)

TICK_INTERVAL_SECONDS = 30


async def run_scheduler_loop(store: Store, *, stop_event: asyncio.Event) -> None:
    """Tick forever (until ``stop_event`` is set), running due schedules."""
    logger.info("scheduler loop starting", extra={"tick_seconds": TICK_INTERVAL_SECONDS})
    try:
        while not stop_event.is_set():
            try:
                await _tick(store)
            except Exception:  # noqa: BLE001 — never let a tick kill the loop
                logger.exception("scheduler tick failed")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=TICK_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                pass
    finally:
        logger.info("scheduler loop stopped")


async def _tick(store: Store) -> None:
    now = datetime.now(timezone.utc)
    schedules = [s for s in store.list_schedules() if s.enabled and s.next_run_at <= now]
    if not schedules:
        return

    logger.info("scheduler tick: %d schedule(s) due", len(schedules))

    for schedule in schedules:
        # Run the scan in a worker thread — discovery is sync I/O and would
        # otherwise block the event loop for a few seconds.
        try:
            summary = await asyncio.to_thread(
                run_in_app_scan,
                store,
                targets=schedule.targets,
                sample_ids=schedule.sample_ids,
                allow_public=schedule.allow_public,
            )
            updated = schedule.model_copy(update={
                "last_run_at": now,
                "next_run_at": now + timedelta(minutes=schedule.interval_minutes),
                "last_scan_id": summary.scan_id,
                "last_status": "ok",
            })
        except TargetRejected as exc:
            updated = _record_failure(schedule, now, f"target rejected: {exc}")
        except Exception as exc:  # noqa: BLE001
            logger.exception("scheduled scan failed", extra={"schedule_id": schedule.schedule_id})
            updated = _record_failure(schedule, now, f"error: {exc}")

        store.upsert_schedule(updated)


def _record_failure(schedule: Schedule, now: datetime, message: str) -> Schedule:
    return schedule.model_copy(update={
        "last_run_at": now,
        "next_run_at": now + timedelta(minutes=schedule.interval_minutes),
        "last_status": message[:200],
    })
