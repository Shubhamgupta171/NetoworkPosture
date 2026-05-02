"""FastAPI entry point — also exported as the Lambda handler via mangum."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import cis_results, devices, firewall_rules, health, ingest, scans, schedules
from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.services.scheduler import run_scheduler_loop
from app.services.storage import get_store

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Spawn the in-process scheduler.

    Disabled when ``DISABLE_SCHEDULER=1`` (used by tests and by Lambda, where
    EventBridge handles tick scheduling instead).
    """
    stop_event = asyncio.Event()
    task: asyncio.Task | None = None
    if os.environ.get("DISABLE_SCHEDULER") not in {"1", "true", "True"}:
        task = asyncio.create_task(run_scheduler_loop(get_store(), stop_event=stop_event))
        logger.info("scheduler enabled")
    else:
        logger.info("scheduler disabled by env")

    try:
        yield
    finally:
        stop_event.set()
        if task is not None:
            try:
                await asyncio.wait_for(task, timeout=5)
            except asyncio.TimeoutError:
                task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Network Posture Scanner",
        version=__version__,
        description=(
            "Discovers reachable hosts, parses firewall configs, and reports "
            "CIS-aligned posture findings."
        ),
        openapi_tags=[
            {"name": "health", "description": "Liveness probe (no auth)."},
            {"name": "ingest", "description": "Scanner submits scan results here."},
            {"name": "scans", "description": "Trigger scans from the dashboard, list and download reports."},
            {"name": "schedules", "description": "Recurring scans that fire on an interval."},
            {"name": "devices", "description": "Discovered hosts and services."},
            {"name": "firewall", "description": "Parsed firewall rules across vendors."},
            {"name": "cis", "description": "CIS-aligned benchmark check outcomes."},
        ],
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
        allow_headers=["X-Api-Key", "Content-Type"],
        # Browsers hide Content-Disposition unless we explicitly expose it,
        # which would block the downloaded filename in the dashboard.
        expose_headers=["Content-Disposition"],
        allow_credentials=False,
    )

    app.include_router(health.router)
    app.include_router(ingest.router)
    app.include_router(scans.router)
    app.include_router(schedules.router)
    app.include_router(devices.router)
    app.include_router(firewall_rules.router)
    app.include_router(cis_results.router)

    return app


app = create_app()
