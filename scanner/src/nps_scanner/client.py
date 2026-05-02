"""HTTP client for the backend ingest API."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from nps_scanner.discovery import HostFinding
from nps_scanner.firewall import RuleSetDict

logger = logging.getLogger(__name__)


def _host_to_payload(host: HostFinding) -> dict[str, Any]:
    return {
        "ip": host.ip,
        "hostname": host.hostname,
        "mac": host.mac,
        "discovery_method": host.discovery_method,
        "open_ports": [
            {
                "port": p.port,
                "protocol": p.protocol,
                "service": (
                    {"name": p.service or "unknown", "banner": p.banner}
                    if p.service or p.banner
                    else None
                ),
            }
            for p in host.open_ports
        ],
    }


def submit_scan(
    api_url: str,
    api_key: str,
    *,
    scan_id: str,
    devices: list[HostFinding],
    rulesets: list[RuleSetDict],
    started_at: datetime,
    finished_at: datetime | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    payload = {
        "scan_id": scan_id,
        "started_at": started_at.isoformat(),
        "finished_at": (finished_at or datetime.now(timezone.utc)).isoformat(),
        "devices": [_host_to_payload(d) for d in devices],
        "rulesets": [r.to_json() for r in rulesets],
    }
    url = api_url.rstrip("/") + "/ingest"
    headers = {"X-Api-Key": api_key, "Content-Type": "application/json"}
    logger.debug("posting %d devices, %d rulesets to %s", len(devices), len(rulesets), url)

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, json=payload, headers=headers)
    if resp.status_code >= 400:
        raise RuntimeError(f"Ingest failed ({resp.status_code}): {resp.text}")
    return resp.json()
