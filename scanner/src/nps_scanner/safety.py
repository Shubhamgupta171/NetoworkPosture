"""Safety guard — refuses to scan unauthorised targets without explicit consent."""

from __future__ import annotations

import ipaddress
import sys


def assert_targets_allowed(targets: list[str], *, allow_public: bool) -> None:
    """Raise SystemExit if any target is public and consent has not been given."""
    public: list[str] = []
    for spec in targets:
        try:
            net = ipaddress.ip_network(spec, strict=False)
        except ValueError:
            continue
        for host in net.hosts() if net.num_addresses > 1 else [net.network_address]:
            if not (host.is_private or host.is_loopback or host.is_link_local):
                public.append(str(host))

    if not public:
        return

    if not allow_public:
        sys.stderr.write(
            "Refusing to scan public IPs without --allow-public.\n"
            "Public targets present: " + ", ".join(public[:5])
            + ("..." if len(public) > 5 else "") + "\n"
        )
        raise SystemExit(2)

    print(
        "You requested to scan public IPs. Type 'I OWN THIS NETWORK' to confirm: ",
        end="", file=sys.stderr,
    )
    answer = input().strip()
    if answer != "I OWN THIS NETWORK":
        sys.stderr.write("Confirmation failed; aborting.\n")
        raise SystemExit(2)
