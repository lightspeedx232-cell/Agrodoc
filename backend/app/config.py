"""Application configuration.

Settings are loaded from environment variables (or a local ``.env`` file in
development). No secret is ever shipped inside the repository or exposed to the
frontend. Copy ``.env.example`` to ``.env`` and fill in the values you need.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- General ----
    APP_NAME: str = "AgroDoc"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"

    # ---- Database ----
    # SQLite (file) for local development by default.
    # For production use: postgresql+psycopg2://user:pass@host:5432/agrodoc
    DATABASE_URL: str = "sqlite:///./agrodoc.db"

    # ---- Security ----
    # Generate a strong secret, e.g.: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
    SECRET_KEY: str = "dev-only-change-me-please-9f2c7e1a4b8d3a6f0e5b2c7d8a1f4e3b"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    # ---- CORS ----
    # Comma-separated list of allowed origins.
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ---- File uploads ----
    UPLOAD_DIR: str = "uploads"
    MAX_IMAGE_UPLOAD_MB: int = 10
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"

    # ---- Rate limiting ----
    RATE_LIMIT_ENABLED: bool = True

    # ---- AI / Crop Doctor ----
    # Which inference backend to use. "none" means diagnosis is reported
    # as unavailable (the safe default until you configure a real service).
    AI_PROVIDER: Literal["none", "openai", "local"] = "none"
    # Used when AI_PROVIDER=openai  (OpenAI Vision compatible API)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_VISION_MODEL: str = "gpt-4o-mini"
    # Used when AI_PROVIDER=local (a local model file you point at)
    LOCAL_MODEL_PATH: str = ""

    # ---- Weather API ----
    # Open-Meteo is free and needs no key; set provider here for future swap.
    WEATHER_PROVIDER: Literal["open-meteo", "none"] = "open-meteo"

    # ---- Mandi prices (data.gov.in / AGMARKNET open data) ----
    # Live prices require a free data.gov.in API key + a resource id.
    # When not set, the mandi endpoint returns the official source links only.
    MANDI_DATA_GOV_API_KEY: str = ""
    MANDI_DATA_GOV_RESOURCE_ID: str = ""
    MANDI_DATA_GOV_BASE_URL: str = "https://api.data.gov.in/resource"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def allowed_image_mime_set(self) -> set[str]:
        return {t.strip() for t in self.ALLOWED_IMAGE_TYPES.split(",") if t.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
