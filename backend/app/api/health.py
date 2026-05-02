"""Public health endpoint — no auth, used by load balancers and the dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.services.storage import get_store

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    db_status = "ok"
    db_error = None
    try:
        from app.services.storage import get_store
        store = get_store()
        store.list_scans()
    except Exception as e:
        db_status = "error"
        db_error = str(e)

    return {
        "status": "ok",
        "version": __version__,
        "database": db_status,
        "database_error": db_error
    }


@router.get("/scheduler-tick")
async def trigger_scheduler_tick() -> dict:
    """Manual trigger for the scheduler tick — used by Vercel Cron or EventBridge."""
    from app.services.scheduler import _tick
    from app.services.storage import get_store
    await _tick(get_store())
    return {"status": "ok", "message": "Scheduler tick completed"}
