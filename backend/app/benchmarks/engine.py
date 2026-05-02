"""Benchmark engine: instantiates checks, runs them, returns results."""

from __future__ import annotations

from app.benchmarks.base import BenchmarkCheck
from app.benchmarks.checks.cis_net_001_insecure_protocols import InsecureProtocolsCheck
from app.benchmarks.checks.cis_net_002_ssh_management_subnet import SshManagementSubnetCheck
from app.benchmarks.checks.cis_net_003_weak_snmp import WeakSnmpCommunityCheck
from app.benchmarks.checks.cis_net_004_open_sensitive_ports import OpenSensitivePortsCheck
from app.benchmarks.checks.cis_net_005_egress_filtering import EgressFilteringCheck
from app.benchmarks.checks.cis_net_006_remote_logging import RemoteLoggingCheck
from app.benchmarks.checks.cis_net_007_stateful_firewall import StatefulFirewallCheck
from app.benchmarks.checks.cis_net_008_legacy_tls import LegacyTlsCheck
from app.models import BenchmarkResult, Device, FirewallRuleSet


def registered_checks() -> list[BenchmarkCheck]:
    return [
        InsecureProtocolsCheck(),
        SshManagementSubnetCheck(),
        WeakSnmpCommunityCheck(),
        OpenSensitivePortsCheck(),
        EgressFilteringCheck(),
        RemoteLoggingCheck(),
        StatefulFirewallCheck(),
        LegacyTlsCheck(),
    ]


def evaluate(
    devices: list[Device],
    rulesets: list[FirewallRuleSet],
) -> list[BenchmarkResult]:
    results: list[BenchmarkResult] = []
    for check in registered_checks():
        results.extend(check.evaluate(devices, rulesets))
    return results
