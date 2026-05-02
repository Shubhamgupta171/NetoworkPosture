"""Storage abstraction.

Three implementations live here:
* ``MemoryStore`` — useful for unit tests.
* ``FileStore``   — single-process local development; persists to a JSON file.
* ``DynamoDBStore`` — production / Lambda; one table, partition by record kind.

Routes never depend on the concrete class — they take a ``Store`` protocol.
"""

from __future__ import annotations

import json
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from app.core.settings import Settings, get_settings
from app.models import BenchmarkResult, Device, FirewallRuleSet, ScanSummary, Schedule

_DEVICES = "devices"
_RULESETS = "rulesets"
_RESULTS = "results"
_SCANS = "scans"
_SCHEDULES = "schedules"


class Store(ABC):
    @abstractmethod
    def upsert_devices(self, devices: list[Device]) -> None: ...

    @abstractmethod
    def upsert_rulesets(self, rulesets: list[FirewallRuleSet]) -> None: ...

    @abstractmethod
    def replace_results(self, results: list[BenchmarkResult]) -> None: ...

    @abstractmethod
    def record_scan(self, summary: ScanSummary) -> None: ...

    @abstractmethod
    def list_devices(self) -> list[Device]: ...

    @abstractmethod
    def list_rulesets(self) -> list[FirewallRuleSet]: ...

    @abstractmethod
    def list_results(self) -> list[BenchmarkResult]: ...

    @abstractmethod
    def list_scans(self) -> list[ScanSummary]: ...

    @abstractmethod
    def upsert_schedule(self, schedule: Schedule) -> None: ...

    @abstractmethod
    def delete_schedule(self, schedule_id: str) -> bool: ...

    @abstractmethod
    def list_schedules(self) -> list[Schedule]: ...


class MemoryStore(Store):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[str, dict[str, Any]] = {
            _DEVICES: {},
            _RULESETS: {},
            _RESULTS: {},
            _SCANS: {},
            _SCHEDULES: {},
        }

    def upsert_devices(self, devices: list[Device]) -> None:
        with self._lock:
            for d in devices:
                self._data[_DEVICES][d.id] = d.model_dump(mode="json")

    def upsert_rulesets(self, rulesets: list[FirewallRuleSet]) -> None:
        with self._lock:
            for rs in rulesets:
                self._data[_RULESETS][rs.id] = rs.model_dump(mode="json")

    def replace_results(self, results: list[BenchmarkResult]) -> None:
        with self._lock:
            self._data[_RESULTS].clear()
            for r in results:
                self._data[_RESULTS][r.id] = r.model_dump(mode="json")

    def record_scan(self, summary: ScanSummary) -> None:
        with self._lock:
            self._data[_SCANS][summary.scan_id] = summary.model_dump(mode="json")

    def list_devices(self) -> list[Device]:
        with self._lock:
            return [Device.model_validate(d) for d in self._data[_DEVICES].values()]

    def list_rulesets(self) -> list[FirewallRuleSet]:
        with self._lock:
            return [FirewallRuleSet.model_validate(r) for r in self._data[_RULESETS].values()]

    def list_results(self) -> list[BenchmarkResult]:
        with self._lock:
            return [BenchmarkResult.model_validate(r) for r in self._data[_RESULTS].values()]

    def list_scans(self) -> list[ScanSummary]:
        with self._lock:
            return [ScanSummary.model_validate(s) for s in self._data[_SCANS].values()]

    def upsert_schedule(self, schedule: Schedule) -> None:
        with self._lock:
            self._data[_SCHEDULES][schedule.schedule_id] = schedule.model_dump(mode="json")

    def delete_schedule(self, schedule_id: str) -> bool:
        with self._lock:
            return self._data[_SCHEDULES].pop(schedule_id, None) is not None

    def list_schedules(self) -> list[Schedule]:
        with self._lock:
            return [Schedule.model_validate(s) for s in self._data[_SCHEDULES].values()]


class FileStore(MemoryStore):
    """File-backed store. Inherits MemoryStore for the in-memory ops, then snapshots to JSON."""

    def __init__(self, path: Path) -> None:
        super().__init__()
        self._path = path
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text())
                for key in (_DEVICES, _RULESETS, _RESULTS, _SCANS, _SCHEDULES):
                    self._data.setdefault(key, {})
            except json.JSONDecodeError:
                # Corrupt file — start fresh rather than crash the process.
                pass

    def _flush(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, default=str, indent=2))
        tmp.replace(self._path)

    def upsert_devices(self, devices: list[Device]) -> None:
        super().upsert_devices(devices)
        self._flush()

    def upsert_rulesets(self, rulesets: list[FirewallRuleSet]) -> None:
        super().upsert_rulesets(rulesets)
        self._flush()

    def replace_results(self, results: list[BenchmarkResult]) -> None:
        super().replace_results(results)
        self._flush()

    def record_scan(self, summary: ScanSummary) -> None:
        super().record_scan(summary)
        self._flush()

    def upsert_schedule(self, schedule: Schedule) -> None:
        super().upsert_schedule(schedule)
        self._flush()

    def delete_schedule(self, schedule_id: str) -> bool:
        ok = super().delete_schedule(schedule_id)
        if ok:
            self._flush()
        return ok


class DynamoDBStore(Store):
    """Single-table DynamoDB store. PK = record kind, SK = record id."""

    def __init__(self, table_name: str, region: str) -> None:
        import boto3

        self._table = boto3.resource("dynamodb", region_name=region).Table(table_name)

    def _put_batch(self, kind: str, items: list[dict[str, Any]]) -> None:
        with self._table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item={"pk": kind, "sk": item["id"], **item})

    def _query(self, kind: str) -> list[dict[str, Any]]:
        from boto3.dynamodb.conditions import Key

        resp = self._table.query(KeyConditionExpression=Key("pk").eq(kind))
        return resp.get("Items", [])

    def upsert_devices(self, devices: list[Device]) -> None:
        self._put_batch(_DEVICES, [{**d.model_dump(mode="json"), "id": d.id} for d in devices])

    def upsert_rulesets(self, rulesets: list[FirewallRuleSet]) -> None:
        self._put_batch(_RULESETS, [{**r.model_dump(mode="json"), "id": r.id} for r in rulesets])

    def replace_results(self, results: list[BenchmarkResult]) -> None:
        # DynamoDB has no truncate; query+delete then put.
        existing = self._query(_RESULTS)
        with self._table.batch_writer() as batch:
            for item in existing:
                batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
        self._put_batch(_RESULTS, [{**r.model_dump(mode="json"), "id": r.id} for r in results])

    def record_scan(self, summary: ScanSummary) -> None:
        self._put_batch(_SCANS, [{**summary.model_dump(mode="json"), "id": summary.scan_id}])

    def list_devices(self) -> list[Device]:
        return [Device.model_validate(i) for i in self._query(_DEVICES)]

    def list_rulesets(self) -> list[FirewallRuleSet]:
        return [FirewallRuleSet.model_validate(i) for i in self._query(_RULESETS)]

    def list_results(self) -> list[BenchmarkResult]:
        return [BenchmarkResult.model_validate(i) for i in self._query(_RESULTS)]

    def list_scans(self) -> list[ScanSummary]:
        return [ScanSummary.model_validate(i) for i in self._query(_SCANS)]

    def upsert_schedule(self, schedule: Schedule) -> None:
        self._put_batch(_SCHEDULES, [{**schedule.model_dump(mode="json"),
                                      "id": schedule.schedule_id}])

    def delete_schedule(self, schedule_id: str) -> bool:
        self._table.delete_item(Key={"pk": _SCHEDULES, "sk": schedule_id})
        return True

    def list_schedules(self) -> list[Schedule]:
        return [Schedule.model_validate(i) for i in self._query(_SCHEDULES)]


class PostgresStore(Store):
    """PostgreSQL store. Stores pydantic models as JSONB."""

    def __init__(self, dsn: str) -> None:
        import psycopg2
        from psycopg2.extras import Json

        self._dsn = dsn
        self._Json = Json
        # Ensure table exists
        with psycopg2.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nps_storage (
                        kind TEXT NOT NULL,
                        id TEXT NOT NULL,
                        data JSONB NOT NULL,
                        PRIMARY KEY (kind, id)
                    );
                """)

    def _upsert_batch(self, kind: str, items: list[dict[str, Any]]) -> None:
        import psycopg2
        with psycopg2.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                for item in items:
                    cur.execute("""
                        INSERT INTO nps_storage (kind, id, data)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data;
                    """, (kind, item["id"], self._Json(item)))

    def _query(self, kind: str) -> list[dict[str, Any]]:
        import psycopg2
        with psycopg2.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT data FROM nps_storage WHERE kind = %s", (kind,))
                return [row[0] for row in cur.fetchall()]

    def upsert_devices(self, devices: list[Device]) -> None:
        self._upsert_batch(_DEVICES, [{**d.model_dump(mode="json"), "id": d.id} for d in devices])

    def upsert_rulesets(self, rulesets: list[FirewallRuleSet]) -> None:
        self._upsert_batch(_RULESETS, [{**r.model_dump(mode="json"), "id": r.id} for r in rulesets])

    def replace_results(self, results: list[BenchmarkResult]) -> None:
        import psycopg2
        with psycopg2.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM nps_storage WHERE kind = %s", (_RESULTS,))
        self._upsert_batch(_RESULTS, [{**r.model_dump(mode="json"), "id": r.id} for r in results])

    def record_scan(self, summary: ScanSummary) -> None:
        self._upsert_batch(_SCANS, [{**summary.model_dump(mode="json"), "id": summary.scan_id}])

    def list_devices(self) -> list[Device]:
        return [Device.model_validate(i) for i in self._query(_DEVICES)]

    def list_rulesets(self) -> list[FirewallRuleSet]:
        return [FirewallRuleSet.model_validate(i) for i in self._query(_RULESETS)]

    def list_results(self) -> list[BenchmarkResult]:
        return [BenchmarkResult.model_validate(i) for i in self._query(_RESULTS)]

    def list_scans(self) -> list[ScanSummary]:
        return [ScanSummary.model_validate(i) for i in self._query(_SCANS)]

    def upsert_schedule(self, schedule: Schedule) -> None:
        self._upsert_batch(_SCHEDULES, [{**schedule.model_dump(mode="json"),
                                       "id": schedule.schedule_id}])

    def delete_schedule(self, schedule_id: str) -> bool:
        import psycopg2
        with psycopg2.connect(self._dsn) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM nps_storage WHERE kind = %s AND id = %s",
                            (_SCHEDULES, schedule_id))
        return True

    def list_schedules(self) -> list[Schedule]:
        return [Schedule.model_validate(i) for i in self._query(_SCHEDULES)]


def build_store(settings: Settings | None = None) -> Store:
    settings = settings or get_settings()
    if settings.storage_backend == "memory":
        return MemoryStore()
    if settings.storage_backend == "file":
        return FileStore(Path(settings.local_store_path))
    if settings.storage_backend == "dynamodb":
        return DynamoDBStore(settings.dynamodb_table, settings.aws_region)
    if settings.storage_backend == "postgres":
        return PostgresStore(settings.database_url)
    raise ValueError(f"Unknown storage backend: {settings.storage_backend}")


_store_singleton: Store | None = None


def get_store() -> Store:
    global _store_singleton
    if _store_singleton is None:
        _store_singleton = build_store()
    return _store_singleton


def reset_store_for_tests(store: Store) -> None:
    """Test hook — replace the singleton with a known instance."""
    global _store_singleton
    _store_singleton = store
