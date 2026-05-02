"""API-key authentication.

The same dependency is mounted in front of every route, so the auth surface is
trivial to audit. The comparison is constant-time to avoid leaking key prefixes
through timing side-channels.
"""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from app.core.settings import get_settings


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = get_settings().api_key
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Api-Key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
