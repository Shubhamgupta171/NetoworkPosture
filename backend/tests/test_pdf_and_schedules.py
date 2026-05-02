"""Tests for the PDF report download and schedule CRUD + tick loop."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.models import Schedule
from app.services.scheduler import _tick
from app.services.storage import MemoryStore

HEADERS = {"X-Api-Key": "test-key"}


def _seed_scan(client: TestClient) -> str:
    r = client.post(
        "/scans",
        headers=HEADERS,
        json={"targets": ["127.0.0.1"], "sample_ids": ["iptables-permissive",
                                                       "aws-sg-wide-open",
                                                       "cisco-legacy"]},
    )
    assert r.status_code == 201, r.text
    return r.json()["scan_id"]


# ── PDF report ────────────────────────────────────────────────────────────────

def test_report_pdf_download(client: TestClient) -> None:
    scan_id = _seed_scan(client)
    r = client.get(f"/scans/{scan_id}/report?format=pdf", headers=HEADERS)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert "attachment" in r.headers["content-disposition"]
    assert ".pdf" in r.headers["content-disposition"]
    body = r.content
    assert body[:4] == b"%PDF", "expected a PDF magic header"
    assert len(body) > 2000, "PDF should contain at least a cover + summary"


# ── Schedule CRUD ─────────────────────────────────────────────────────────────

def test_schedule_lifecycle(client: TestClient) -> None:
    payload = {
        "name": "Production VPC nightly",
        "targets": ["127.0.0.1"],
        "sample_ids": ["iptables-permissive"],
        "interval_minutes": 60,
        "enabled": True,
    }
    create = client.post("/schedules", headers=HEADERS, json=payload)
    assert create.status_code == 201, create.text
    sid = create.json()["schedule_id"]

    listed = client.get("/schedules", headers=HEADERS).json()
    assert any(s["schedule_id"] == sid for s in listed)

    patch = client.patch(f"/schedules/{sid}", headers=HEADERS,
                         json={"enabled": False, "interval_minutes": 1440})
    assert patch.status_code == 200
    assert patch.json()["enabled"] is False
    assert patch.json()["interval_minutes"] == 1440

    delete = client.delete(f"/schedules/{sid}", headers=HEADERS)
    assert delete.status_code == 204
    assert client.delete(f"/schedules/{sid}", headers=HEADERS).status_code == 404


def test_schedule_validates_interval(client: TestClient) -> None:
    bad = client.post(
        "/schedules", headers=HEADERS,
        json={"name": "x", "targets": ["127.0.0.1"], "interval_minutes": 5},
    )
    assert bad.status_code == 422


# ── Tick loop logic ───────────────────────────────────────────────────────────

def test_tick_runs_due_schedule_and_advances_next_run(store: MemoryStore) -> None:
    now = datetime.now(timezone.utc)
    schedule = Schedule(
        schedule_id="t1",
        name="Localhost every 15 min",
        targets=["127.0.0.1"],
        sample_ids=["iptables-permissive"],
        interval_minutes=15,
        enabled=True,
        created_at=now - timedelta(minutes=20),
        next_run_at=now - timedelta(seconds=5),  # due
    )
    store.upsert_schedule(schedule)

    asyncio.run(_tick(store))

    after = next(s for s in store.list_schedules() if s.schedule_id == "t1")
    assert after.last_status == "ok"
    assert after.last_scan_id is not None
    assert after.next_run_at > now  # advanced into the future
    # And a scan record should exist.
    assert any(s.scan_id == after.last_scan_id for s in store.list_scans())


def test_tick_skips_disabled_schedule(store: MemoryStore) -> None:
    schedule = Schedule(
        schedule_id="t-disabled",
        name="Disabled",
        targets=["127.0.0.1"],
        sample_ids=[],
        interval_minutes=15,
        enabled=False,
        next_run_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    store.upsert_schedule(schedule)

    asyncio.run(_tick(store))

    after = next(s for s in store.list_schedules() if s.schedule_id == "t-disabled")
    assert after.last_status is None  # never ran


def test_tick_records_failure_on_invalid_target(store: MemoryStore) -> None:
    schedule = Schedule(
        schedule_id="t-bad",
        name="Bad target",
        targets=["8.8.8.8"],  # public, not allowed
        sample_ids=[],
        interval_minutes=15,
        enabled=True,
        allow_public=False,
        next_run_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    store.upsert_schedule(schedule)

    asyncio.run(_tick(store))

    after = next(s for s in store.list_schedules() if s.schedule_id == "t-bad")
    assert after.last_status is not None
    assert "target rejected" in after.last_status.lower()
