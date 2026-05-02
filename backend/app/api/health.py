"""Public health endpoint — no auth, used by load balancers and the dashboard."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@router.get("/scheduler-tick")
async def trigger_scheduler_tick() -> dict:
    """Manual trigger for the scheduler tick — used by Vercel Cron or EventBridge."""
    from app.services.scheduler import _tick
    from app.services.storage import get_store
    await _tick(get_store())
    return {"status": "ok", "message": "Scheduler tick completed"}
