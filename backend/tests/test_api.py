"""API integration tests — auth, ingest round-trip, list endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.parsers import parse_aws_security_group, parse_cisco_ios, parse_iptables_save

HEADERS = {"X-Api-Key": "test-key"}


def _payload(samples_dir: Path) -> dict:
    rulesets = [
        parse_iptables_save((samples_dir / "iptables" / "permissive.rules").read_text(),
                            owner_ip="10.0.0.1"),
        parse_aws_security_group((samples_dir / "aws-sg" / "wide-open.json").read_text()),
        parse_cisco_ios((samples_dir / "cisco" / "legacy-edge.cfg").read_text()),
    ]
    return {
        "scan_id": "test-scan-1",
        "devices": [
            {"ip": "10.0.0.1", "hostname": "lab",
             "open_ports": [{"port": 22, "service": {"name": "ssh", "banner": "OpenSSH_9.6"}}]}
        ],
        "rulesets": [r.model_dump(mode="json") for r in rulesets],
    }


def test_health_is_public(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_devices_requires_auth(client: TestClient) -> None:
    r = client.get("/devices")
    assert r.status_code == 401


def test_ingest_requires_auth(client: TestClient, samples_dir: Path) -> None:
    r = client.post("/ingest", json=_payload(samples_dir))
    assert r.status_code == 401


def test_full_ingest_roundtrip(client: TestClient, samples_dir: Path) -> None:
    payload = _payload(samples_dir)
    r = client.post("/ingest", json=payload, headers=HEADERS)
    assert r.status_code == 201, r.text
    summary = r.json()
    assert summary["device_count"] == 1
    assert summary["ruleset_count"] == 3
    assert summary["fail_count"] >= 1

    devices = client.get("/devices", headers=HEADERS).json()
    assert any(d["ip"] == "10.0.0.1" for d in devices)

    rules = client.get("/firewall-rules", headers=HEADERS).json()
    assert {r["source_type"] for r in rules} == {"iptables", "aws-sg", "cisco-ios"}

    cis = client.get("/cis-results", headers=HEADERS).json()
    check_ids = {r["check_id"] for r in cis}
    assert {"CIS-NET-001", "CIS-NET-002", "CIS-NET-003", "CIS-NET-004",
            "CIS-NET-005", "CIS-NET-006", "CIS-NET-007", "CIS-NET-008"}.issubset(check_ids)

    summary = client.get("/cis-results/summary", headers=HEADERS).json()
    assert summary["total"] == len(cis)


def test_catalog_lists_all_eight_checks(client: TestClient) -> None:
    r = client.get("/cis-results/catalog", headers=HEADERS)
    assert r.status_code == 200
    assert len(r.json()) == 8
