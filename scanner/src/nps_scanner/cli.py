"""Command-line interface — wraps discovery, firewall parsing, and ingestion."""

from __future__ import annotations

import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from nps_scanner import __version__
from nps_scanner.client import submit_scan
from nps_scanner.discovery import DEFAULT_PORTS, HostFinding, scan_targets
from nps_scanner.firewall import RuleSetDict, SourceType, load_firewall
from nps_scanner.safety import assert_targets_allowed

load_dotenv()

app = typer.Typer(
    name="nps-scanner",
    help="Network Posture Scanner — discover hosts, parse firewall configs, ship results.",
    no_args_is_help=True,
    add_completion=False,
)
console = Console()


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
    )


def _print_devices(hosts: list[HostFinding]) -> None:
    table = Table(title="Discovered hosts")
    table.add_column("IP")
    table.add_column("Hostname")
    table.add_column("MAC")
    table.add_column("Open ports")
    for h in hosts:
        ports = ", ".join(
            f"{p.port}/{p.protocol}" + (f" {p.service}" if p.service else "")
            for p in h.open_ports
        ) or "—"
        table.add_row(h.ip, h.hostname or "—", h.mac or "—", ports)
    console.print(table)


def _print_rulesets(rulesets: list[RuleSetDict]) -> None:
    table = Table(title="Loaded firewall rulesets")
    table.add_column("ID")
    table.add_column("Source")
    table.add_column("Rules")
    for rs in rulesets:
        table.add_row(rs.ruleset_id, rs.source_type, str(len(rs.rules)))
    console.print(table)


@app.command()
def version() -> None:
    """Print version and exit."""
    typer.echo(f"nps-scanner {__version__}")


@app.command()
def scan(
    targets: Annotated[
        list[str] | None,
        typer.Option(
            "--targets", "-t",
            help="IP or CIDR. Repeat or comma-separate. Defaults to 127.0.0.1.",
        ),
    ] = None,
    ports: Annotated[
        str | None,
        typer.Option(help="Comma-separated TCP ports. Defaults to a common-services list."),
    ] = None,
    firewall_source: Annotated[
        list[str] | None,
        typer.Option(
            "--firewall-source",
            help="Repeat once per file: iptables | aws-sg | cisco-ios",
        ),
    ] = None,
    firewall_file: Annotated[
        list[Path] | None,
        typer.Option("--firewall-file", help="Path to a firewall config (matches order of --firewall-source)."),
    ] = None,
    api_url: Annotated[
        str,
        typer.Option(envvar="NPS_API_URL", help="Backend base URL."),
    ] = "http://localhost:8000",
    api_key: Annotated[
        str | None,
        typer.Option(envvar="NPS_API_KEY", help="X-Api-Key value (or set NPS_API_KEY)."),
    ] = None,
    submit: Annotated[
        bool, typer.Option(help="POST results to the backend after the scan."),
    ] = True,
    allow_public: Annotated[
        bool,
        typer.Option(help="Allow scanning non-RFC1918 targets (requires interactive consent)."),
    ] = False,
    verbose: Annotated[bool, typer.Option("-v", "--verbose")] = False,
) -> None:
    """Run a scan, parse provided firewall configs, and (optionally) ship results."""
    _configure_logging(verbose)

    target_list = _normalise_targets(targets)
    assert_targets_allowed(target_list, allow_public=allow_public)

    port_tuple = _parse_ports(ports)
    started = datetime.now(timezone.utc)

    console.print(
        f"[bold cyan]→[/bold cyan] scanning {len(target_list)} target(s) "
        f"on {len(port_tuple)} ports..."
    )
    hosts = scan_targets(target_list, ports=port_tuple)
    _print_devices(hosts)

    rulesets = _load_rulesets(firewall_source, firewall_file)
    if rulesets:
        _print_rulesets(rulesets)

    if not submit:
        console.print("[yellow]--no-submit set: skipping ingest.[/yellow]")
        return

    if not api_key:
        api_key = os.environ.get("NPS_API_KEY")
    if not api_key:
        console.print("[red]No API key — set NPS_API_KEY or pass --api-key.[/red]")
        raise typer.Exit(2)

    scan_id = uuid.uuid4().hex
    console.print(f"[bold cyan]→[/bold cyan] submitting scan {scan_id} to {api_url}...")
    try:
        report = submit_scan(
            api_url, api_key, scan_id=scan_id, devices=hosts, rulesets=rulesets,
            started_at=started,
        )
    except Exception as exc:  # noqa: BLE001 — surface any HTTP/network problem
        console.print(f"[red]ingest error:[/red] {exc}")
        raise typer.Exit(1) from exc

    console.print(
        f"[green]✓[/green] {report['device_count']} devices, "
        f"{report['ruleset_count']} rulesets, "
        f"[green]{report['pass_count']} passed[/green] / "
        f"[red]{report['fail_count']} failed[/red] checks."
    )


def _normalise_targets(targets: list[str] | None) -> list[str]:
    if not targets:
        return ["127.0.0.1"]
    out: list[str] = []
    for spec in targets:
        out.extend(s.strip() for s in spec.split(",") if s.strip())
    return out


def _parse_ports(ports: str | None) -> tuple[int, ...]:
    if not ports:
        return DEFAULT_PORTS
    try:
        return tuple(int(p.strip()) for p in ports.split(",") if p.strip())
    except ValueError as exc:
        raise typer.BadParameter(f"Invalid --ports: {exc}") from exc


_VALID_SOURCES = {"iptables", "aws-sg", "cisco-ios"}


def _load_rulesets(
    sources: list[str] | None, files: list[Path] | None,
) -> list[RuleSetDict]:
    sources = sources or []
    files = files or []
    if len(sources) != len(files):
        raise typer.BadParameter(
            f"--firewall-source ({len(sources)}) and --firewall-file ({len(files)}) "
            "must be supplied the same number of times."
        )
    out: list[RuleSetDict] = []
    for source, path in zip(sources, files, strict=True):
        if source not in _VALID_SOURCES:
            raise typer.BadParameter(
                f"Unknown --firewall-source '{source}'. "
                f"Expected one of: {', '.join(sorted(_VALID_SOURCES))}"
            )
        if not path.exists():
            console.print(f"[red]Skipping missing fixture:[/red] {path}")
            continue
        out.append(load_firewall(source, path))  # type: ignore[arg-type]
    return out


if __name__ == "__main__":
    app()
