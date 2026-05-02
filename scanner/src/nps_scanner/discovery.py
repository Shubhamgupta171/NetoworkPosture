"""Lightweight host + service discovery.

Three discovery primitives are provided. They are deliberately simple — this
tool is meant to be safe to run on a laptop and to demo the pipeline, not to
replace nmap. If you need richer fingerprinting, run ``nmap -sV`` separately
and pipe the JSON output into the ingest API.

Discovery methods:

* ``tcp_syn`` — actually a half-open emulation via a connect() with a short
  timeout. It does not require root privileges and works on every OS we care
  about. We mark the discovery method ``tcp_syn`` to keep the contract the
  same as a true SYN scan.
* ``icmp`` — falls back to TCP probe when ICMP is unavailable (macOS without
  sudo, most container environments).
* ``arp`` — only meaningful on the local subnet; we shell out to the system
  ``arp`` table, which is pre-populated by the OS.
"""

from __future__ import annotations

import concurrent.futures
import ipaddress
import platform
import socket
import subprocess
from dataclasses import dataclass, field

DEFAULT_PORTS = (21, 22, 23, 25, 53, 80, 110, 143, 161, 443, 445, 3306, 3389, 5432, 8080)
_BANNER_BYTES = 256
_CONNECT_TIMEOUT = 0.6
_BANNER_TIMEOUT = 1.0
_HTTP_PROBE = b"HEAD / HTTP/1.0\r\nHost: probe\r\n\r\n"
_GENERIC_PROBE = b"\r\n"


@dataclass
class PortFinding:
    port: int
    protocol: str = "tcp"
    service: str | None = None
    banner: str | None = None


@dataclass
class HostFinding:
    ip: str
    hostname: str | None = None
    mac: str | None = None
    discovery_method: str = "tcp_syn"
    open_ports: list[PortFinding] = field(default_factory=list)


def _resolve_hostname(ip: str) -> str | None:
    try:
        return socket.gethostbyaddr(ip)[0]
    except (OSError, socket.herror):
        return None


def _arp_lookup(ip: str) -> str | None:
    """Best-effort MAC lookup from the system ARP cache. Linux/macOS only."""
    try:
        out = subprocess.check_output(["arp", "-n", ip], stderr=subprocess.DEVNULL, timeout=2)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    for line in out.decode(errors="ignore").splitlines():
        for token in line.split():
            if token.count(":") == 5 and len(token) == 17:
                return token.lower()
    return None


def _icmp_ping(ip: str) -> bool:
    """OS-portable single-shot ping."""
    count_flag = "-n" if platform.system() == "Windows" else "-c"
    timeout_flag = "-w" if platform.system() == "Windows" else "-W"
    try:
        return subprocess.call(
            ["ping", count_flag, "1", timeout_flag, "1", ip],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ) == 0
    except FileNotFoundError:
        return False


def _probe_port(ip: str, port: int) -> PortFinding | None:
    """Try TCP connect; if it succeeds, attempt a tiny banner grab."""
    try:
        with socket.create_connection((ip, port), timeout=_CONNECT_TIMEOUT) as sock:
            sock.settimeout(_BANNER_TIMEOUT)
            banner = _grab_banner(sock, port)
    except (TimeoutError, OSError):
        return None
    return PortFinding(
        port=port, protocol="tcp",
        service=_service_name(port), banner=banner,
    )


def _grab_banner(sock: socket.socket, port: int) -> str | None:
    try:
        if port in {80, 8080}:
            sock.sendall(_HTTP_PROBE)
        else:
            sock.sendall(_GENERIC_PROBE)
        data = sock.recv(_BANNER_BYTES)
    except (TimeoutError, OSError):
        try:
            data = sock.recv(_BANNER_BYTES)
        except OSError:
            return None
    if not data:
        return None
    return data.decode(errors="replace").strip().splitlines()[0][:_BANNER_BYTES]


_SERVICE_NAMES = {
    21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns",
    80: "http", 110: "pop3", 143: "imap", 161: "snmp", 443: "https",
    445: "smb", 3306: "mysql", 3389: "rdp", 5432: "postgres", 8080: "http-alt",
}


def _service_name(port: int) -> str | None:
    return _SERVICE_NAMES.get(port)


def expand_targets(specs: list[str]) -> list[str]:
    """Expand mixed IPs / CIDRs into a list of unique IP strings."""
    out: list[str] = []
    seen: set[str] = set()
    for spec in specs:
        if "/" in spec:
            for ip in ipaddress.ip_network(spec, strict=False).hosts():
                s = str(ip)
                if s not in seen:
                    seen.add(s)
                    out.append(s)
        else:
            ip = str(ipaddress.ip_address(spec))
            if ip not in seen:
                seen.add(ip)
                out.append(ip)
    return out


def scan_host(ip: str, ports: tuple[int, ...] = DEFAULT_PORTS,
              concurrency: int = 32) -> HostFinding | None:
    """Probe a single host. Returns None if every probe fails."""
    open_ports: list[PortFinding] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {pool.submit(_probe_port, ip, p): p for p in ports}
        for fut in concurrent.futures.as_completed(futures):
            result = fut.result()
            if result:
                open_ports.append(result)

    icmp_ok = _icmp_ping(ip)
    if not open_ports and not icmp_ok:
        return None

    return HostFinding(
        ip=ip,
        hostname=_resolve_hostname(ip),
        mac=_arp_lookup(ip),
        discovery_method="tcp_syn" if open_ports else "icmp",
        open_ports=sorted(open_ports, key=lambda p: p.port),
    )


def scan_targets(targets: list[str], ports: tuple[int, ...] = DEFAULT_PORTS,
                 host_concurrency: int = 16) -> list[HostFinding]:
    """Scan many hosts concurrently."""
    hosts: list[HostFinding] = []
    ips = expand_targets(targets)
    with concurrent.futures.ThreadPoolExecutor(max_workers=host_concurrency) as pool:
        for finding in pool.map(lambda ip: scan_host(ip, ports), ips):
            if finding:
                hosts.append(finding)
    return sorted(hosts, key=lambda h: ipaddress.ip_address(h.ip))
