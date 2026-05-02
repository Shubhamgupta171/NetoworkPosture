"""Common FastAPI dependencies."""

from __future__ import annotations

from fastapi import Depends

from app.core.security import require_api_key
from app.services.storage import Store, get_store


def store_dep() -> Store:
    return get_store()


AuthorizedRoute = Depends(require_api_key)
