"""Scanner-side firewall config loading.

The scanner reads source files locally and POSTs the parsed result to the
backend. We re-use the backend's parsers rather than re-implementing them, by
importing from the ``app`` package when available. If not (e.g. when the
scanner is installed standalone), we shell out to the backend over HTTP and
let the server parse — but the local path is faster and works offline.

To keep the scanner package independent, we use a tiny local copy of the
parsers' shape: we just emit the raw JSON the backend expects.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

SourceType = Literal["iptables", "aws-sg", "cisco-ios"]


@dataclass
class RuleDict:
    rule_id: str
    direction: str
    action: str
    protocol: str
    source: str
    destination: str
    port_range: str
    description: str | None
    raw: str | None

    def to_json(self) -> dict:
        return self.__dict__


@dataclass
class RuleSetDict:
    ruleset_id: str
    source_type: SourceType
    name: str
    rules: list[RuleDict]
    metadata: dict[str, str]
    owner_ip: str | None = None

    def to_json(self) -> dict:
        return {
            "ruleset_id": self.ruleset_id,
            "source_type": self.source_type,
            "name": self.name,
            "owner_ip": self.owner_ip,
            "rules": [r.to_json() for r in self.rules],
            "metadata": self.metadata,
        }


# ----- iptables ---------------------------------------------------------------

_CHAIN_DIRECTION = {"INPUT": "ingress", "FORWARD": "ingress", "OUTPUT": "egress"}
_IPT_ACTION = {"ACCEPT": "allow", "DROP": "deny", "REJECT": "deny", "LOG": "log"}


def _flag(tokens: list[str], name: str) -> str | None:
    if name in tokens:
        idx = tokens.index(name)
        if idx + 1 < len(tokens):
            return tokens[idx + 1]
    return None


def _iter_ipt_lines(text: str) -> Iterator[tuple[str, str]]:
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("-A "):
            yield s.split()[1], s


def parse_iptables(text: str, owner_ip: str | None = None) -> RuleSetDict:
    rules: list[RuleDict] = []
    chain_defaults: dict[str, str] = {}
    for line in text.splitlines():
        m = re.match(r":(\w+)\s+(\w+)", line)
        if m:
            chain_defaults[m.group(1)] = m.group(2)

    for index, (chain, raw) in enumerate(_iter_ipt_lines(text), start=1):
        tokens = raw.split()
        rules.append(RuleDict(
            rule_id=f"{chain}-{index}",
            direction=_CHAIN_DIRECTION.get(chain, "ingress"),
            action=_IPT_ACTION.get(_flag(tokens, "-j") or "ACCEPT", "allow"),
            protocol=_flag(tokens, "-p") or "any",
            source=_flag(tokens, "-s") or "any",
            destination=_flag(tokens, "-d") or "any",
            port_range=_flag(tokens, "--dport") or _flag(tokens, "--sport") or "any",
            description=None,
            raw=raw,
        ))
    for chain, policy in chain_defaults.items():
        if chain not in _CHAIN_DIRECTION:
            continue
        rules.append(RuleDict(
            rule_id=f"{chain}-default",
            direction=_CHAIN_DIRECTION[chain],
            action="default-deny" if policy == "DROP" else "default-allow",
            protocol="any", source="any", destination="any", port_range="any",
            description=f"Chain {chain} default policy",
            raw=f":{chain} {policy}",
        ))
    return RuleSetDict(
        ruleset_id=f"host-{owner_ip}" if owner_ip else "host-local",
        source_type="iptables",
        name=f"iptables@{owner_ip or 'host'}",
        rules=rules,
        metadata={},
        owner_ip=owner_ip,
    )


# ----- AWS Security Group -----------------------------------------------------

def _aws_port(perm: dict) -> str:
    if perm.get("IpProtocol") == "-1":
        return "any"
    f, t = perm.get("FromPort"), perm.get("ToPort")
    if f is None and t is None:
        return "any"
    return str(f) if f == t else f"{f}-{t}"


def _aws_expand(perm: dict, direction: str, prefix: str) -> list[RuleDict]:
    proto = perm.get("IpProtocol", "any")
    proto = "any" if proto == "-1" else proto
    port = _aws_port(perm)
    rules: list[RuleDict] = []
    for idx, ip_range in enumerate(perm.get("IpRanges", []), start=1):
        cidr = ip_range["CidrIp"]
        rules.append(RuleDict(
            rule_id=f"{prefix}-cidr-{idx}",
            direction=direction, action="allow", protocol=proto,
            source=cidr if direction == "ingress" else "self",
            destination="self" if direction == "ingress" else cidr,
            port_range=port,
            description=ip_range.get("Description"),
            raw=json.dumps({**perm, "IpRanges": [ip_range]}),
        ))
    for idx, pair in enumerate(perm.get("UserIdGroupPairs", []), start=1):
        peer = pair.get("GroupId", "?")
        rules.append(RuleDict(
            rule_id=f"{prefix}-sg-{idx}",
            direction=direction, action="allow", protocol=proto,
            source=peer if direction == "ingress" else "self",
            destination="self" if direction == "ingress" else peer,
            port_range=port,
            description=pair.get("Description"),
            raw=json.dumps({**perm, "UserIdGroupPairs": [pair]}),
        ))
    return rules


def parse_aws_sg(payload: str | dict) -> RuleSetDict:
    obj = json.loads(payload) if isinstance(payload, str) else payload
    rules: list[RuleDict] = []
    for i, p in enumerate(obj.get("IpPermissions", []), start=1):
        rules.extend(_aws_expand(p, "ingress", f"in-{i}"))
    for i, p in enumerate(obj.get("IpPermissionsEgress", []), start=1):
        rules.extend(_aws_expand(p, "egress", f"eg-{i}"))
    metadata = {"vpc_id": obj.get("VpcId", "")}
    for tag in obj.get("Tags", []):
        metadata[f"tag:{tag['Key']}"] = tag["Value"]
    return RuleSetDict(
        ruleset_id=obj["GroupId"],
        source_type="aws-sg",
        name=obj.get("GroupName", obj["GroupId"]),
        rules=rules,
        metadata=metadata,
    )


# ----- Cisco IOS --------------------------------------------------------------

def parse_cisco(text: str) -> RuleSetDict:
    """Tiny Cisco parser — kept symmetrical with the backend implementation.

    The ``backend/app/parsers/cisco.py`` module is the canonical version with
    full ACL-source resolution; the scanner only needs to extract enough
    structure for the backend to validate. So we ship the raw text along with a
    minimal parsed shape.
    """
    rules: list[RuleDict] = []
    metadata: dict[str, str] = {}
    name = "cisco-router"

    for line in text.splitlines():
        s = line.strip()
        if s.startswith("hostname "):
            name = s.split(maxsplit=1)[1]
            metadata["hostname"] = name
        elif s == "no logging on":
            metadata["logging_enabled"] = "false"
        elif s.startswith("logging host "):
            metadata["logging_host"] = s.split()[-1]
            metadata["logging_enabled"] = "true"
        elif s.startswith("snmp-server community "):
            tokens = s.split()
            community = tokens[2]
            access = tokens[3] if len(tokens) > 3 else "RO"
            rules.append(RuleDict(
                rule_id=f"snmp-community-{community}",
                direction="ingress", action="allow", protocol="snmp",
                source="any", destination="self", port_range="161",
                description=f"SNMP community '{community}' ({access})",
                raw=s,
            ))
    metadata.setdefault("logging_enabled", "true")
    return RuleSetDict(
        ruleset_id=name,
        source_type="cisco-ios",
        name=name,
        rules=rules,
        metadata=metadata,
    )


# ----- Dispatcher -------------------------------------------------------------

def load_firewall(source: SourceType, path: Path,
                  owner_ip: str | None = None) -> RuleSetDict:
    text = path.read_text()
    if source == "iptables":
        return parse_iptables(text, owner_ip=owner_ip)
    if source == "aws-sg":
        return parse_aws_sg(text)
    if source == "cisco-ios":
        return parse_cisco(text)
    raise ValueError(f"Unsupported firewall source: {source}")
