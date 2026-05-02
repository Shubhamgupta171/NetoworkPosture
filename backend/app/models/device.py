"""Discovered host and service models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, IPvAnyAddress

DiscoveryMethod = Literal["icmp", "tcp_syn", "arp", "manual"]


class DeviceService(BaseModel):
    name: str = Field(..., description="Service name (ssh, http, telnet, snmp, ...)")
    banner: str | None = Field(default=None, description="Raw banner text, truncated to 256 bytes.")


class OpenPort(BaseModel):
    port: int = Field(..., ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"
    service: DeviceService | None = None


class Device(BaseModel):
    ip: IPvAnyAddress
    hostname: str | None = None
    mac: str | None = Field(default=None, description="Layer-2 MAC address if same subnet.")
    mac_vendor: str | None = None
    discovery_method: DiscoveryMethod = "icmp"
    open_ports: list[OpenPort] = Field(default_factory=list)
    discovered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def id(self) -> str:
        return str(self.ip)
