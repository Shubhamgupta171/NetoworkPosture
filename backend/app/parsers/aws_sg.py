"""Parser for AWS EC2 Security Group ``DescribeSecurityGroups`` JSON output."""

from __future__ import annotations

import json
from typing import Any

from app.models.firewall import Direction, FirewallRule, FirewallRuleSet


def _port_range(perm: dict[str, Any]) -> str:
    proto = perm.get("IpProtocol")
    if proto == "-1":
        return "any"
    from_port = perm.get("FromPort")
    to_port = perm.get("ToPort")
    if from_port is None and to_port is None:
        return "any"
    if from_port == to_port:
        return str(from_port)
    return f"{from_port}-{to_port}"


def _expand(perm: dict[str, Any], direction: Direction, prefix: str) -> list[FirewallRule]:
    proto = perm.get("IpProtocol", "any")
    proto = "any" if proto == "-1" else proto
    port = _port_range(perm)
    rules: list[FirewallRule] = []

    for idx, ip_range in enumerate(perm.get("IpRanges", []), start=1):
        cidr = ip_range["CidrIp"]
        rules.append(
            FirewallRule(
                rule_id=f"{prefix}-cidr-{idx}",
                direction=direction,
                action="allow",
                protocol=proto,
                source=cidr if direction == "ingress" else "self",
                destination="self" if direction == "ingress" else cidr,
                port_range=port,
                description=ip_range.get("Description"),
                raw=json.dumps({**perm, "IpRanges": [ip_range]}),
            )
        )

    for idx, pair in enumerate(perm.get("UserIdGroupPairs", []), start=1):
        peer = pair.get("GroupId", "?")
        rules.append(
            FirewallRule(
                rule_id=f"{prefix}-sg-{idx}",
                direction=direction,
                action="allow",
                protocol=proto,
                source=peer if direction == "ingress" else "self",
                destination="self" if direction == "ingress" else peer,
                port_range=port,
                description=pair.get("Description"),
                raw=json.dumps({**perm, "UserIdGroupPairs": [pair]}),
            )
        )

    return rules


def parse_aws_security_group(payload: str | dict[str, Any]) -> FirewallRuleSet:
    """Parse a single Security Group payload (the JSON shape returned by
    ``aws ec2 describe-security-groups`` for one group).
    """
    if isinstance(payload, str):
        payload = json.loads(payload)

    rules: list[FirewallRule] = []
    for i, perm in enumerate(payload.get("IpPermissions", []), start=1):
        rules.extend(_expand(perm, "ingress", f"in-{i}"))
    for i, perm in enumerate(payload.get("IpPermissionsEgress", []), start=1):
        rules.extend(_expand(perm, "egress", f"eg-{i}"))

    metadata = {"vpc_id": payload.get("VpcId", "")}
    for tag in payload.get("Tags", []):
        metadata[f"tag:{tag['Key']}"] = tag["Value"]

    return FirewallRuleSet(
        ruleset_id=payload["GroupId"],
        source_type="aws-sg",
        name=payload.get("GroupName", payload["GroupId"]),
        rules=rules,
        metadata=metadata,
    )
