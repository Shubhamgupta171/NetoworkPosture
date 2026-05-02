"""POST /ingest — scanner submits discovery + parsed firewall configs.

The Lambda/FastAPI accepts the payload, runs the benchmark engine over the
combined view of devices + rulesets, and persists the results.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status

from app.api.deps import AuthorizedRoute, store_dep
from app.benchmarks import evaluate
from app.models import IngestPayload, ScanReport, ScanSummary
from app.services.storage import Store

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[AuthorizedRoute])
logger = logging.getLogger(__name__)


@router.post("", response_model=ScanReport, status_code=status.HTTP_201_CREATED)
async def ingest(payload: IngestPayload, store: Store = Depends(store_dep)) -> ScanReport:
    store.upsert_devices(payload.devices)
    store.upsert_rulesets(payload.rulesets)

    results = evaluate(payload.devices, payload.rulesets)
    store.replace_results(results)

    pass_count = sum(1 for r in results if r.outcome == "pass")
    fail_count = sum(1 for r in results if r.outcome == "fail")

    summary = ScanSummary(
        scan_id=payload.scan_id,
        started_at=payload.started_at,
        finished_at=payload.finished_at,
        device_count=len(payload.devices),
        ruleset_count=len(payload.rulesets),
        pass_count=pass_count,
        fail_count=fail_count,
    )
    store.record_scan(summary)

    logger.info(
        "scan ingested",
        extra={
            "scan_id": payload.scan_id,
            "devices": len(payload.devices),
            "rulesets": len(payload.rulesets),
            "pass": pass_count,
            "fail": fail_count,
        },
    )

    return ScanReport(**summary.model_dump())
