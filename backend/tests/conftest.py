from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Test isolation — keep storage in-memory, use a known API key, and never
# spin up the background scheduler loop (we test it directly in unit tests).
os.environ.setdefault("STORAGE_BACKEND", "memory")
os.environ.setdefault("API_KEY", "test-key")
os.environ.setdefault("DISABLE_SCHEDULER", "1")

from app.core.settings import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.storage import MemoryStore, reset_store_for_tests  # noqa: E402


@pytest.fixture
def store() -> MemoryStore:
    s = MemoryStore()
    reset_store_for_tests(s)
    return s


@pytest.fixture
def client(store: MemoryStore) -> TestClient:  # noqa: ARG001
    get_settings.cache_clear()
    return TestClient(create_app())


SAMPLES = Path(__file__).resolve().parents[2] / "samples"


@pytest.fixture
def samples_dir() -> Path:
    return SAMPLES
