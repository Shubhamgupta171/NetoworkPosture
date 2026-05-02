"""Glue between the discovery service, parsers, benchmark engine, and storage.

The HTTP layer calls this for both kinds of scans:
* From the dashboard form (in-process discovery + bundled sample fixtures).
* From the CLI scanner (just persists what the scanner already produced).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal
from uuid import uuid4

from app.benchmarks import evaluate
from app.core.settings import get_settings
from app.models import Device, FirewallRuleSet, ScanSummary
from app.parsers import parse_aws_security_group, parse_cisco_ios, parse_iptables_save
from app.services.discovery import normalise_targets, scan_targets
from app.services.storage import Store

logger = logging.getLogger(__name__)

SampleId = Literal[
    "iptables-permissive", "iptables-hardened",
    "aws-sg-wide-open", "aws-sg-restrictive",
    "cisco-legacy", "cisco-hardened",
]

# Maps a sample id to (parser, file path relative to SAMPLES_DIR).
_SAMPLES: dict[str, tuple[str, str]] = {
    "iptables-permissive": ("iptables", "iptables/permissive.rules"),
    "iptables-hardened":   ("iptables", "iptables/hardened.rules"),
    "aws-sg-wide-open":    ("aws-sg",   "aws-sg/wide-open.json"),
    "aws-sg-restrictive":  ("aws-sg",   "aws-sg/restrictive.json"),
    "cisco-legacy":        ("cisco-ios","cisco/legacy-edge.cfg"),
    "cisco-hardened":      ("cisco-ios","cisco/hardened-edge.cfg"),
}


def _samples_dir() -> Path:
    """Locate the bundled sample fixtures.

    Resolution order:
    1. Explicit ``SAMPLES_DIR`` env var (handy for Lambda packaging).
    2. ``../samples`` relative to the backend package — works in dev.
    """
    settings = get_settings()
    explicit = getattr(settings, "samples_dir", None)
    if explicit:
        return Path(explicit)
    return Path(__file__).resolve().parent.parent / "samples"


def list_available_samples() -> list[dict[str, str]]:
    """Return the sample catalog the dashboard renders as checkboxes."""
    base = _samples_dir()
    out: list[dict[str, str]] = []
    for sample_id, (source_type, rel_path) in _SAMPLES.items():
        path = base / rel_path
        out.append({
            "id": sample_id,
            "source_type": source_type,
            "label": _humanize(sample_id),
            "available": "true" if path.exists() else "false",
        })
    return out


def _humanize(sample_id: str) -> str:
    text = sample_id.replace("-", " ").title()
    return (
        text
        .replace("Aws", "AWS")
        .replace("Sg", "SG")
        .replace("Ios", "IOS")
    )


def _load_sample(sample_id: str) -> FirewallRuleSet:
    if sample_id not in _SAMPLES:
        raise ValueError(f"Unknown sample id: {sample_id}")
    source_type, rel_path = _SAMPLES[sample_id]
    path = _samples_dir() / rel_path
    if not path.exists():
        raise FileNotFoundError(f"Sample fixture missing on the server: {rel_path}")

    text = path.read_text()
    if source_type == "iptables":
        return parse_iptables_save(text, ruleset_id=sample_id)
    if source_type == "aws-sg":
        return parse_aws_security_group(text)
    if source_type == "cisco-ios":
        return parse_cisco_ios(text, ruleset_id=sample_id)
    raise ValueError(f"Unknown parser for sample {sample_id}")


def run_in_app_scan(
    store: Store,
    *,
    targets: list[str],
    sample_ids: Iterable[str] = (),
    allow_public: bool = False,
) -> ScanSummary:
    """Run host discovery on ``targets``, layer in the requested sample fixtures,
    evaluate every CIS check, and persist the lot.
    """
    started = datetime.now(timezone.utc)
    ips = normalise_targets(targets, allow_public=allow_public)
    devices: list[Device] = scan_targets(ips)

    rulesets: list[FirewallRuleSet] = []
    for sid in sample_ids:
        try:
            rulesets.append(_load_sample(sid))
        except (FileNotFoundError, ValueError) as exc:
            logger.warning("skipping sample %s: %s", sid, exc)

    # Persist discovered hosts and rulesets, then re-run the engine across
    # everything currently stored so the user sees a coherent posture state.
    store.upsert_devices(devices)
    store.upsert_rulesets(rulesets)
    all_devices = store.list_devices()
    all_rulesets = store.list_rulesets()
    results = evaluate(all_devices, all_rulesets)
    store.replace_results(results)

    summary = ScanSummary(
        scan_id=uuid4().hex,
        started_at=started,
        finished_at=datetime.now(timezone.utc),
        device_count=len(devices),
        ruleset_count=len(rulesets),
        pass_count=sum(1 for r in results if r.outcome == "pass"),
        fail_count=sum(1 for r in results if r.outcome == "fail"),
    )
    store.record_scan(summary)
    logger.info(
        "in-app scan complete",
        extra={
            "scan_id": summary.scan_id,
            "targets_requested": len(targets),
            "targets_resolved": len(ips),
            "devices_found": len(devices),
            "samples": list(sample_ids),
        },
    )
    return summary
