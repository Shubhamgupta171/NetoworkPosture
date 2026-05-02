"""GET /devices — discovered hosts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import AuthorizedRoute, store_dep
from app.models import Device
from app.services.storage import Store

router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[AuthorizedRoute])


@router.get("", response_model=list[Device])
async def list_devices(store: Store = Depends(store_dep)) -> list[Device]:
    return sorted(store.list_devices(), key=lambda d: str(d.ip))


@router.get("/{ip}", response_model=Device)
async def get_device(ip: str, store: Store = Depends(store_dep)) -> Device:
    for device in store.list_devices():
        if str(device.ip) == ip:
            return device
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No device with ip={ip}")
