"""Application settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

StorageBackend = Literal["memory", "file", "dynamodb", "postgres"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    api_key: str = Field(
        default="dev-insecure-key",
        description="Shared secret required in the X-Api-Key header.",
    )
    storage_backend: StorageBackend = "file"
    local_store_path: str = "./data/store.json"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"

    aws_region: str = "ap-south-1"
    dynamodb_table: str = "network-posture-scanner"

    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000"
    log_level: str = "INFO"

    # Optional override for where the bundled sample firewall fixtures live.
    # Defaults to ../samples relative to the backend package (dev workflow).
    samples_dir: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
