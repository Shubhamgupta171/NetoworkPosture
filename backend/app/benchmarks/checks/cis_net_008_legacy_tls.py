"""CIS-NET-008 — No legacy TLS / cleartext HTTP banners on discovered hosts."""

from __future__ import annotations

from app.benchmarks.base import BenchmarkCheck, CheckMetadata
from app.models import BenchmarkResult, Device, FirewallRuleSet

_LEGACY_BANNER_HINTS = (
    "SSLv2", "SSLv3", "TLSv1.0", "TLSv1.1",
    "Server: Apache/1.", "Server: Apache/2.0",  # ancient Apache
    "Server: lighttpd/1.4.0",                   # ancient lighttpd
    "OpenSSH_5.",                                # pre-AES-GCM
)


class LegacyTlsCheck(BenchmarkCheck):
    meta = CheckMetadata(
        check_id="CIS-NET-008",
        title="No legacy / insecure protocol banners advertised",
        cis_reference="CIS Controls v8 — 3.10",
        severity="medium",
        remediation=(
            "Disable SSL/TLS ≤ 1.1 on listeners, upgrade web servers and SSH daemons "
            "to vendor-supported releases, and remove legacy ciphersuites."
        ),
    )

    def evaluate(
        self, devices: list[Device], rulesets: list[FirewallRuleSet]
    ) -> list[BenchmarkResult]:
        results: list[BenchmarkResult] = []
        for device in devices:
            offending: list[str] = []
            for p in device.open_ports:
                if not p.service or not p.service.banner:
                    continue
                banner = p.service.banner
                for hint in _LEGACY_BANNER_HINTS:
                    if hint in banner:
                        offending.append(f"port {p.port}: banner '{banner}' contains '{hint}'")
                        break
            outcome = "fail" if offending else "pass"
            evidence = offending or [f"No legacy protocol banners on {device.ip}"]
            results.append(
                self._result(
                    target_id=str(device.ip), target_kind="device",
                    outcome=outcome, evidence=evidence,
                )
            )
        return results
