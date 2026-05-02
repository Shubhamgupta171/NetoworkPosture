"""Backend-side host discovery used by the in-app scan trigger.

Mirrors the CLI scanner's TCP-connect probing but with stricter bounds, since
this code runs inside the request-handling Lambda / FastAPI process and must
return inside the gateway's 30-second budget.

The CLI scanner stays the canonical implementation for production use — this
module exists so the dashboard can demo scans against localhost or a small,
pre-vetted set of targets without an operator running the CLI.
"""

from __future__ import annotations

import concurrent.futures
import ipaddress
import socket
from datetime import datetime, timezone

from app.models.device import Device, DeviceService, OpenPort

# Hard limits — the in-app scanner is for demo, not for sweeping a /16.
MAX_TARGETS = 16
DEFAULT_PORTS: tuple[int, ...] = (22, 23, 53, 80, 443, 445, 3306, 3389, 5432, 8080, 8443)
_CONNECT_TIMEOUT = 0.5
_BANNER_TIMEOUT = 0.8
_BANNER_BYTES = 256
_HTTP_PROBE = b"HEAD / HTTP/1.0\r\nHost: probe\r\n\r\n"

_SERVICE_NAMES: dict[int, str] = {
    22: "ssh", 23: "telnet", 53: "dns", 80: "http",
    443: "https", 445: "smb", 3306: "mysql", 3389: "rdp",
    5432: "postgres", 8080: "http-alt", 8443: "https-alt",
}


class TargetRejected(ValueError):
    """Raised when the user's target list violates a safety rule."""


def normalise_targets(specs: list[str], *, allow_public: bool = False) -> list[str]:
    """Resolve a mixed list of IPs / CIDRs / hostnames into a flat IP list.

    * Hostnames are resolved via the system resolver.
    * CIDRs are expanded.
    * Public IPs are rejected unless ``allow_public`` is true.
    * The total target count is capped at ``MAX_TARGETS``.
    """
    out: list[str] = []
    seen: set[str] = set()

    for raw in specs:
        spec = raw.strip()
        if not spec:
            continue

        # CIDR or single IP — try numeric first.
        try:
            net = ipaddress.ip_network(spec, strict=False)
            hosts = (
                [net.network_address]
                if net.num_addresses == 1
                else list(net.hosts())
            )
            for h in hosts:
                _add_if_allowed(str(h), out, seen, allow_public, raw)
            continue
        except ValueError:
            pass

        # Hostname — resolve to a single IP.
        try:
            ip = socket.gethostbyname(_strip_scheme(spec))
        except socket.gaierror as exc:
            raise TargetRejected(f"Could not resolve hostname '{raw}': {exc}") from exc
        _add_if_allowed(ip, out, seen, allow_public, raw)

    if not out:
        raise TargetRejected("No valid targets supplied.")
    if len(out) > MAX_TARGETS:
        raise TargetRejected(
            f"Too many targets ({len(out)}). The in-app scanner is capped at "
            f"{MAX_TARGETS} per scan; use the CLI for larger sweeps."
        )
    return out


def _strip_scheme(s: str) -> str:
    """Tolerate users pasting 'https://example.com/path'."""
    for prefix in ("https://", "http://", "ssh://"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):]
    return s.split("/", 1)[0].split(":", 1)[0]


def _add_if_allowed(
    ip: str, out: list[str], seen: set[str], allow_public: bool, original: str,
) -> None:
    if ip in seen:
        return
    addr = ipaddress.ip_address(ip)
    if not (addr.is_private or addr.is_loopback or addr.is_link_local) and not allow_public:
        raise TargetRejected(
            f"Target '{original}' resolves to public IP {ip}. "
            "Tick 'Allow public targets' to override (only scan networks you own)."
        )
    seen.add(ip)
    out.append(ip)


def scan_host(ip: str, ports: tuple[int, ...] = DEFAULT_PORTS) -> Device | None:
    """Probe a single host for open TCP ports + a one-line banner."""
    open_ports: list[OpenPort] = []
    for port in ports:
        result = _probe_port(ip, port)
        if result:
            open_ports.append(result)

    hostname = _resolve_hostname(ip)
    if not open_ports and hostname is None:
        # Treat as unreachable.
        return None

    return Device(
        ip=ip,
        hostname=hostname,
        discovery_method="tcp_syn" if open_ports else "icmp",
        open_ports=sorted(open_ports, key=lambda p: p.port),
        discovered_at=datetime.now(timezone.utc),
    )


def scan_targets(targets: list[str], ports: tuple[int, ...] = DEFAULT_PORTS) -> list[Device]:
    """Concurrently scan a small list of targets."""
    devices: list[Device] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, max(1, len(targets)))) as pool:
        for d in pool.map(lambda ip: scan_host(ip, ports), targets):
            if d:
                devices.append(d)
    return sorted(devices, key=lambda d: ipaddress.ip_address(str(d.ip)))


def _probe_port(ip: str, port: int) -> OpenPort | None:
    try:
        with socket.create_connection((ip, port), timeout=_CONNECT_TIMEOUT) as sock:
            sock.settimeout(_BANNER_TIMEOUT)
            banner = _grab_banner(sock, port)
    except (TimeoutError, OSError):
        return None
    return OpenPort(
        port=port,
        protocol="tcp",
        service=DeviceService(name=_SERVICE_NAMES.get(port, "unknown"), banner=banner),
    )


def _grab_banner(sock: socket.socket, port: int) -> str | None:
    try:
        if port in {80, 8080, 8443}:
            sock.sendall(_HTTP_PROBE)
        data = sock.recv(_BANNER_BYTES)
    except (TimeoutError, OSError):
        try:
            data = sock.recv(_BANNER_BYTES)
        except OSError:
            return None
    if not data:
        return None
    return data.decode(errors="replace").strip().splitlines()[0][:_BANNER_BYTES]


def _resolve_hostname(ip: str) -> str | None:
    try:
        return socket.gethostbyaddr(ip)[0]
    except (OSError, socket.herror):
        return None
