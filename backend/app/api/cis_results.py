"""GET /cis-results — benchmark check outcomes."""

from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import AuthorizedRoute, store_dep
from app.benchmarks import registered_checks
from app.models import BenchmarkResult
from app.services.storage import Store

router = APIRouter(prefix="/cis-results", tags=["cis"], dependencies=[AuthorizedRoute])


class CisCatalogEntry(BaseModel):
    check_id: str
    title: str
    cis_reference: str
    severity: str
    remediation: str


class CisSummary(BaseModel):
    total: int
    passed: int
    failed: int
    not_applicable: int
    by_severity: dict[str, int]


@router.get("", response_model=list[BenchmarkResult])
async def list_results(
    outcome: str | None = Query(default=None, pattern="^(pass|fail|not_applicable)$"),
    store: Store = Depends(store_dep),
) -> list[BenchmarkResult]:
    results = store.list_results()
    if outcome:
        results = [r for r in results if r.outcome == outcome]
    return sorted(results, key=lambda r: (r.check_id, r.target_id))


@router.get("/summary", response_model=CisSummary)
async def summary(store: Store = Depends(store_dep)) -> CisSummary:
    results = store.list_results()
    sev = Counter(r.severity for r in results if r.outcome == "fail")
    return CisSummary(
        total=len(results),
        passed=sum(1 for r in results if r.outcome == "pass"),
        failed=sum(1 for r in results if r.outcome == "fail"),
        not_applicable=sum(1 for r in results if r.outcome == "not_applicable"),
        by_severity=dict(sev),
    )


@router.get("/catalog", response_model=list[CisCatalogEntry])
async def catalog() -> list[CisCatalogEntry]:
    return [
        CisCatalogEntry(
            check_id=c.meta.check_id,
            title=c.meta.title,
            cis_reference=c.meta.cis_reference,
            severity=c.meta.severity,
            remediation=c.meta.remediation,
        )
        for c in registered_checks()
    ]
