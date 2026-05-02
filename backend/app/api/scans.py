"""Scan trigger + report download endpoints used by the dashboard."""

from __future__ import annotations

import csv
import io
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import AuthorizedRoute, store_dep
from app.models import ScanSummary
from app.services.orchestrator import (
    list_available_samples,
    run_in_app_scan,
)
from app.services.discovery import MAX_TARGETS, TargetRejected
from app.services.report_pdf import render_pdf
from app.services.storage import Store

router = APIRouter(prefix="/scans", tags=["scans"], dependencies=[AuthorizedRoute])

ReportFormat = Literal["json", "csv", "pdf"]


class StartScanRequest(BaseModel):
    targets: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_TARGETS,
        description="IPs, CIDRs, or hostnames. Hostnames are resolved server-side.",
        examples=[["127.0.0.1", "10.0.0.0/29"]],
    )
    sample_ids: list[str] = Field(
        default_factory=list,
        description="Optional sample firewall fixtures to layer into the scan.",
    )
    allow_public: bool = Field(
        default=False,
        description="Permit non-RFC1918 targets. Off by default as a safety guard.",
    )


@router.get("/samples")
async def samples() -> list[dict[str, str]]:
    """Catalog of bundled sample fixtures the form can offer as checkboxes."""
    return list_available_samples()


@router.post("", response_model=ScanSummary, status_code=status.HTTP_201_CREATED)
async def start_scan(req: StartScanRequest, store: Store = Depends(store_dep)) -> ScanSummary:
    try:
        return run_in_app_scan(
            store,
            targets=req.targets,
            sample_ids=req.sample_ids,
            allow_public=req.allow_public,
        )
    except TargetRejected as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("", response_model=list[ScanSummary])
async def list_scans(store: Store = Depends(store_dep)) -> list[ScanSummary]:
    """Return all scans, newest first."""
    return sorted(store.list_scans(), key=lambda s: s.started_at, reverse=True)


@router.get("/{scan_id}", response_model=ScanSummary)
async def get_scan(scan_id: str, store: Store = Depends(store_dep)) -> ScanSummary:
    for s in store.list_scans():
        if s.scan_id == scan_id:
            return s
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No scan with id={scan_id}")


@router.get("/{scan_id}/report")
async def download_report(
    scan_id: str,
    format: ReportFormat = Query(default="json"),
    store: Store = Depends(store_dep),
) -> StreamingResponse:
    """Serve a downloadable report.

    Reports are computed from the *current* store state — they reflect the
    posture that exists right now, even if the scan record itself is older.
    For per-scan immutable snapshots, persist the device + ruleset shadow
    alongside the scan summary; the storage layer already supports that
    (see ``Store.upsert_devices``) — adding it here would just be more
    plumbing than the demo needs.
    """
    summary = next((s for s in store.list_scans() if s.scan_id == scan_id), None)
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No scan with id={scan_id}",
        )

    devices = store.list_devices()
    rulesets = store.list_rulesets()
    results = store.list_results()

    if format == "json":
        body = json.dumps(
            {
                "scan": summary.model_dump(mode="json"),
                "devices": [d.model_dump(mode="json") for d in devices],
                "rulesets": [r.model_dump(mode="json") for r in rulesets],
                "cis_results": [r.model_dump(mode="json") for r in results],
            },
            indent=2,
        )
        return StreamingResponse(
            iter([body]),
            media_type="application/json",
            headers={
                "Content-Disposition":
                    f'attachment; filename="nps-report-{scan_id[:12]}.json"',
            },
        )

    if format == "pdf":
        pdf_bytes = render_pdf(
            scan=summary, devices=devices, rulesets=rulesets, results=results,
        )
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition":
                    f'attachment; filename="nps-report-{scan_id[:12]}.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    # CSV — flatten the most useful tables side by side.
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "section", "check_id", "title", "severity", "outcome", "target_kind",
        "target_id", "evidence", "remediation",
    ])
    for r in results:
        writer.writerow([
            "cis_result", r.check_id, r.title, r.severity, r.outcome,
            r.target_kind, r.target_id, " | ".join(r.evidence), r.remediation or "",
        ])
    writer.writerow([])
    writer.writerow(["section", "ip", "hostname", "mac", "open_ports"])
    for d in devices:
        ports = "; ".join(
            f"{p.port}/{p.protocol}"
            + (f" {p.service.name}" if p.service and p.service.name else "")
            for p in d.open_ports
        )
        writer.writerow(["device", str(d.ip), d.hostname or "", d.mac or "", ports])
    writer.writerow([])
    writer.writerow(["section", "ruleset", "source_type", "rule_id", "direction",
                     "action", "protocol", "source", "destination", "port_range"])
    for rs in rulesets:
        for r in rs.rules:
            writer.writerow([
                "rule", rs.name, rs.source_type, r.rule_id, r.direction,
                r.action, r.protocol, r.source, r.destination, r.port_range,
            ])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                f'attachment; filename="nps-report-{scan_id[:12]}.csv"',
        },
    )
