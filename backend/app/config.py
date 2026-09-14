import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent
IMAGE_DIR = "/app/static/images"
os.makedirs(IMAGE_DIR, exist_ok=True)

def _env_files() -> tuple[Path, ...]:
    stage = os.environ.get("APP_ENV", "development")
    candidates = (
        BACKEND_DIR / f".env.{stage}.local",
        BACKEND_DIR / f".env.{stage}",
        BACKEND_DIR / ".env",
    )
    return tuple(path for path in candidates if path.is_file())


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "*"
    database_url: str = ""
    frontend_url: str
    session_secret_key: str
    keycloak_server_url: str
    keycloak_internal_url: str  # es werden zwei URLs benötigt, da der Test mit einer Remote-VM sonst nicht funktioniert
    keycloak_external_url: str  # es werden zwei URLs benötigt, da der Test mit einer Remote-VM sonst nicht funktioniert
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_client_secret: str

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

@lru_cache
def get_settings() -> Settings:
    files = _env_files()
    return Settings(_env_file=files or None)

settings = get_settings()