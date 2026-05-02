"""Firewall rule models — a single shape for iptables / AWS SG / Cisco IOS."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RuleAction = Literal["allow", "deny", "log", "default-deny", "default-allow"]
Direction = Literal["ingress", "egress"]
SourceType = Literal["iptables", "aws-sg", "cisco-ios"]


class FirewallRule(BaseModel):
    """A single firewall rule, normalised across vendors."""

    rule_id: str = Field(..., description="Stable identifier within a ruleset (e.g. 'INPUT-3').")
    direction: Direction
    action: RuleAction
    protocol: str = Field(default="any", description="tcp, udp, icmp, any, ...")
    source: str = Field(default="any", description="CIDR, group ID, or 'any'.")
    destination: str = Field(default="any")
    port_range: str = Field(default="any", description="'80', '8000-8100', or 'any'.")
    description: str | None = None
    raw: str | None = Field(default=None, description="Original line for evidence display.")


class FirewallRuleSet(BaseModel):
    """A logically-grouped set of rules from one source (a host, an SG, a router)."""

    ruleset_id: str = Field(..., description="Unique within (source_type, owner). E.g. SG group id.")
    source_type: SourceType
    name: str
    owner_ip: str | None = Field(default=None, description="Host IP if produced by an iptables dump.")
    rules: list[FirewallRule]
    metadata: dict[str, str] = Field(default_factory=dict)

    @property
    def id(self) -> str:
        return f"{self.source_type}:{self.ruleset_id}"
