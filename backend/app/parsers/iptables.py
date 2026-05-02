"""Parser for ``iptables-save`` output.

Only the fields we care about for CIS checks are normalised; the original line
is preserved on each rule for evidence display in the dashboard.
"""

from __future__ import annotations

import re
from typing import Iterator

from app.models.firewall import FirewallRule, FirewallRuleSet, RuleAction

_CHAIN_DIRECTION = {"INPUT": "ingress", "FORWARD": "ingress", "OUTPUT": "egress"}
_ACTION_MAP: dict[str, RuleAction] = {
    "ACCEPT": "allow",
    "DROP": "deny",
    "REJECT": "deny",
    "LOG": "log",
}


def _flag(tokens: list[str], name: str) -> str | None:
    """Return the value following ``name`` in a token list, or None if absent."""
    if name in tokens:
        idx = tokens.index(name)
        if idx + 1 < len(tokens):
            return tokens[idx + 1]
    return None


def _iter_rules(text: str) -> Iterator[tuple[str, str]]:
    """Yield (chain, raw_line) pairs from an iptables-save dump."""
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("-A "):
            tokens = stripped.split()
            yield tokens[1], stripped


def parse_iptables_save(text: str, *, owner_ip: str | None = None,
                        ruleset_id: str | None = None) -> FirewallRuleSet:
    """Parse iptables-save text into a normalised ruleset.

    Args:
        text: Raw output from ``iptables-save``.
        owner_ip: IP of the host the rules came from, used for evidence linking.
        ruleset_id: Override id; defaults to ``host-<owner_ip>`` or ``host-local``.
    """
    rules: list[FirewallRule] = []
    chain_defaults: dict[str, str] = {}

    for line in text.splitlines():
        m = re.match(r":(\w+)\s+(\w+)", line)
        if m:
            chain_defaults[m.group(1)] = m.group(2)

    for index, (chain, raw) in enumerate(_iter_rules(text), start=1):
        tokens = raw.split()
        action = _flag(tokens, "-j") or "ACCEPT"
        protocol = _flag(tokens, "-p") or "any"
        source = _flag(tokens, "-s") or "any"
        destination = _flag(tokens, "-d") or "any"
        port = _flag(tokens, "--dport") or _flag(tokens, "--sport") or "any"

        rules.append(
            FirewallRule(
                rule_id=f"{chain}-{index}",
                direction=_CHAIN_DIRECTION.get(chain, "ingress"),  # type: ignore[arg-type]
                action=_ACTION_MAP.get(action, "allow"),
                protocol=protocol,
                source=source,
                destination=destination,
                port_range=port,
                raw=raw,
            )
        )

    # Synthetic rules representing each chain's default policy — needed for the
    # "default-deny outbound" CIS check.
    for chain, policy in chain_defaults.items():
        if chain not in _CHAIN_DIRECTION:
            continue
        action: RuleAction = "default-deny" if policy == "DROP" else "default-allow"
        rules.append(
            FirewallRule(
                rule_id=f"{chain}-default",
                direction=_CHAIN_DIRECTION[chain],  # type: ignore[arg-type]
                action=action,
                protocol="any",
                source="any",
                destination="any",
                port_range="any",
                description=f"Chain {chain} default policy",
                raw=f":{chain} {policy}",
            )
        )

    name = f"iptables@{owner_ip}" if owner_ip else "iptables@host"
    return FirewallRuleSet(
        ruleset_id=ruleset_id or (f"host-{owner_ip}" if owner_ip else "host-local"),
        source_type="iptables",
        name=name,
        owner_ip=owner_ip,
        rules=rules,
        metadata={"chains": ",".join(sorted(chain_defaults))},
    )
