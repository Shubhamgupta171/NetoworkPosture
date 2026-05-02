"""Tests for the /scans endpoints (in-app scan trigger + report download)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.services.discovery import TargetRejected, normalise_targets

HEADERS = {"X-Api-Key": "test-key"}


def test_normalise_targets_rejects_public_without_flag() -> None:
    try:
        normalise_targets(["8.8.8.8"], allow_public=False)
    except TargetRejected as exc:
        assert "8.8.8.8" in str(exc)
    else:
        raise AssertionError("Expected TargetRejected")


def test_normalise_targets_accepts_loopback_and_private() -> None:
    out = normalise_targets(["127.0.0.1", "10.0.0.0/30"], allow_public=False)
    assert "127.0.0.1" in out
    # /30 has 2 host IPs (per ipaddress.ip_network.hosts()).
    assert any(ip.startswith("10.0.0.") for ip in out)


def test_samples_endpoint_returns_catalog(client: TestClient) -> None:
    r = client.get("/scans/samples", headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    ids = {row["id"] for row in body}
    assert {"iptables-permissive", "aws-sg-wide-open", "cisco-legacy"}.issubset(ids)


def test_start_scan_runs_against_localhost(client: TestClient) -> None:
    """A scan against 127.0.0.1 always succeeds (no targets reachable is fine)
    and produces a stored ScanSummary the user can list."""
    r = client.post(
        "/scans",
        headers=HEADERS,
        json={
            "targets": ["127.0.0.1"],
            "sample_ids": ["iptables-permissive", "aws-sg-wide-open", "cisco-legacy"],
        },
    )
    assert r.status_code == 201, r.text
    summary = r.json()
    assert summary["ruleset_count"] == 3
    assert "scan_id" in summary

    listed = client.get("/scans", headers=HEADERS).json()
    assert any(s["scan_id"] == summary["scan_id"] for s in listed)


def test_start_scan_rejects_public_target(client: TestClient) -> None:
    r = client.post(
        "/scans",
        headers=HEADERS,
        json={"targets": ["8.8.8.8"], "sample_ids": []},
    )
    assert r.status_code == 400
    assert "public" in r.json()["detail"].lower()


def test_report_download_json_and_csv(client: TestClient) -> None:
    # Seed
    summary = client.post(
        "/scans",
        headers=HEADERS,
        json={"targets": ["127.0.0.1"], "sample_ids": ["iptables-permissive"]},
    ).json()
    scan_id = summary["scan_id"]

    j = client.get(f"/scans/{scan_id}/report?format=json", headers=HEADERS)
    assert j.status_code == 200
    assert j.headers["content-type"].startswith("application/json")
    assert "attachment" in j.headers["content-disposition"]
    payload = j.json()
    assert payload["scan"]["scan_id"] == scan_id
    assert "cis_results" in payload

    c = client.get(f"/scans/{scan_id}/report?format=csv", headers=HEADERS)
    assert c.status_code == 200
    assert c.headers["content-type"].startswith("text/csv")
    body = c.text
    assert "section,check_id,title" in body
    assert "cis_result" in body


def test_report_404_for_unknown_scan(client: TestClient) -> None:
    r = client.get("/scans/does-not-exist/report", headers=HEADERS)
    assert r.status_code == 404
