"""Small helpers shared between checks — kept tiny and pure."""

from __future__ import annotations

import ipaddress

INSECURE_SERVICE_PORTS: dict[int, str] = {
    21: "ftp",
    23: "telnet",
    80: "http (cleartext mgmt)",
    161: "snmp v1/v2c",
    513: "rlogin",
    514: "rsh",
}

SENSITIVE_PORTS: dict[int, str] = {
    22: "SSH",
    23: "Telnet",
    445: "SMB",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
}


def is_world_open(cidr: str) -> bool:
    """Return True if the cidr means 'anywhere on the internet'."""
    if cidr in {"any", "0.0.0.0/0", "::/0"}:
        return True
    try:
        net = ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return False
    return net.num_addresses >= 2**24 and net.is_global


def port_overlaps(port_range: str, target: int) -> bool:
    """Check whether ``target`` is inside the rule's port spec."""
    if port_range == "any":
        return True
    if "-" in port_range:
        try:
            lo, hi = (int(x) for x in port_range.split("-", 1))
        except ValueError:
            return False
        return lo <= target <= hi
    try:
        return int(port_range) == target
    except ValueError:
        return False
