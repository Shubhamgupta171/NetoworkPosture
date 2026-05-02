"""Public health endpoint — no auth, used by load balancers and the dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.services.storage import get_store

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(store=Depends(get_store)):
    db_ok = False
    try:
        # Just a simple query to see if DB is alive
        store.list_scans()
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok",
        "version": __version__,
        "database": "ok" if db_ok else "error"
    }


@router.get("/scheduler-tick")
async def trigger_scheduler_tick() -> dict:
    """Manual trigger for the scheduler tick — used by Vercel Cron or EventBridge."""
    from app.services.scheduler import _tick
    from app.services.storage import get_store
    await _tick(get_store())
    return {"status": "ok", "message": "Scheduler tick completed"}
