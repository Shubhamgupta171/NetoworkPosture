"""Parser for Cisco IOS configurations.

We hand-roll a minimal parser instead of pulling in ``ciscoconfparse2`` so
unit tests can run without optional dependencies, and so the parsing rules
are explicit and auditable for security review.
"""

from __future__ import annotations

import re
from typing import Iterator

from app.models.firewall import Direction, FirewallRule, FirewallRuleSet, RuleAction

_ACL_LINE = re.compile(r"^\s*(permit|deny)\s+(\S+)\s+(\S+(?:\s+\S+)?)\s+(\S+(?:\s+\S+)?)\s*(.*)$")
_PORT_EQ = re.compile(r"\beq\s+(\S+)")


def _iter_blocks(lines: list[str]) -> Iterator[tuple[str, list[str]]]:
    """Yield top-level Cisco config blocks: (header, body_lines)."""
    i = 0
    while i < len(lines):
        header = lines[i]
        if header == "" or header.startswith("!"):
            i += 1
            continue
        body: list[str] = []
        i += 1
        while i < len(lines) and (lines[i].startswith(" ") or lines[i] == ""):
            if lines[i].strip():
                body.append(lines[i].strip())
            i += 1
        yield header, body


def _resolve_acl_source(lines: list[str], acl_name: str) -> str:
    """Return a comma-joined list of source networks declared by a standard ACL.

    Falls back to ``acl:<name>`` if the ACL is not a simple permit-list, so the
    UI can still render something meaningful.
    """
    sources: list[str] = []
    capture = False
    for line in lines:
        s = line.strip()
        if s.startswith("ip access-list standard ") and s.endswith(acl_name):
            capture = True
            continue
        if capture:
            if not line.startswith(" ") and s:
                break
            if s.startswith("permit "):
                tokens = s.split()
                if len(tokens) >= 3:
                    # `permit 10.10.0.0 0.0.0.255` → 10.10.0.0/24
                    sources.append(_cisco_to_cidr(tokens[1], tokens[2]))
                elif len(tokens) == 2:
                    sources.append(tokens[1])
    return ",".join(sources) if sources else f"acl:{acl_name}"


def _cisco_to_cidr(network: str, wildcard: str) -> str:
    """Convert ``10.10.0.0 0.0.0.255`` to ``10.10.0.0/24`` (best-effort)."""
    try:
        wc_octets = [int(o) for o in wildcard.split(".")]
        bits = sum(bin(255 - o).count("1") for o in wc_octets)
        return f"{network}/{bits}"
    except (ValueError, IndexError):
        return f"{network} {wildcard}"


def _parse_acl_line(name: str, raw: str, idx: int) -> FirewallRule | None:
    m = _ACL_LINE.match(raw)
    if not m:
        return None
    verb, proto, src, dst, tail = m.groups()
    action: RuleAction = "allow" if verb == "permit" else "deny"
    port_match = _PORT_EQ.search(raw)
    port = port_match.group(1) if port_match else "any"
    return FirewallRule(
        rule_id=f"{name}-{idx}",
        direction="ingress",
        action=action,
        protocol=proto,
        source=src.strip(),
        destination=dst.strip(),
        port_range=port,
        description=tail.strip() or None,
        raw=raw,
    )


def parse_cisco_ios(text: str, *, ruleset_id: str | None = None) -> FirewallRuleSet:
    """Parse a Cisco IOS configuration. The ruleset captures:

    * Hostname and key service flags as metadata (used by CIS-NET-001/006).
    * SNMP community strings as ``snmp-community-*`` rules so weak strings
      surface in the ``/firewall-rules`` API and the dashboard.
    * Each ACL line as a ``FirewallRule``.
    * VTY ``transport input`` lines and access-class membership.
    """
    lines = [ln.rstrip() for ln in text.splitlines()]
    rules: list[FirewallRule] = []
    metadata: dict[str, str] = {}
    name = "cisco-router"

    for header, body in _iter_blocks(lines):
        h = header.strip()

        if h.startswith("hostname "):
            name = h.split(maxsplit=1)[1]
            metadata["hostname"] = name

        elif h in {"ip http server", "ip http secure-server"}:
            metadata[h.replace(" ", "_")] = "true"
        elif h in {"no ip http server", "no ip http secure-server"}:
            metadata[h.replace("no ", "").replace(" ", "_")] = "false"

        elif h == "no logging on":
            metadata["logging_enabled"] = "false"
        elif h.startswith("logging host "):
            metadata["logging_host"] = h.split()[-1]
            metadata["logging_enabled"] = "true"

        elif h.startswith("snmp-server community "):
            tokens = h.split()
            community = tokens[2]
            access = tokens[3] if len(tokens) > 3 else "RO"
            rules.append(
                FirewallRule(
                    rule_id=f"snmp-community-{community}",
                    direction="ingress",
                    action="allow",
                    protocol="snmp",
                    source="any",
                    destination="self",
                    port_range="161",
                    description=f"SNMP community '{community}' ({access})",
                    raw=h,
                )
            )

        elif h.startswith("ip access-list "):
            # e.g. "ip access-list extended OUTSIDE-IN"
            acl_name = h.split()[-1]
            for idx, line in enumerate(body, start=1):
                rule = _parse_acl_line(acl_name, line, idx)
                if rule:
                    rules.append(rule)

        elif h.startswith("line vty"):
            access_class = None
            transports: list[str] = []
            for line in body:
                if line.startswith("transport input"):
                    transports = line.split()[2:]
                elif line.startswith("access-class"):
                    access_class = line.split()[1]
                    metadata["vty_access_class"] = access_class
            for t in transports:
                direction: Direction = "ingress"
                # Resolve the access-class to its declared CIDR(s) when present —
                # this lets CIS-NET-002 see the actual restriction instead of
                # 'any' for VTY SSH on properly-hardened devices.
                source = _resolve_acl_source(lines, access_class) if access_class else "any"
                rules.append(
                    FirewallRule(
                        rule_id=f"vty-{t}",
                        direction=direction,
                        action="allow",
                        protocol=t,
                        source=source,
                        destination="self",
                        port_range="23" if t == "telnet" else "22",
                        description=(
                            f"VTY transport {t}"
                            + (f" restricted by access-class {access_class}"
                               if access_class else " open to all sources")
                        ),
                        raw=f"line vty: transport input {t}"
                            + (f"; access-class {access_class}" if access_class else ""),
                    )
                )

    metadata.setdefault("logging_enabled", "true")  # default IOS state
    return FirewallRuleSet(
        ruleset_id=ruleset_id or name,
        source_type="cisco-ios",
        name=name,
        rules=rules,
        metadata=metadata,
    )
