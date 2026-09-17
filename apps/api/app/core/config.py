from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+psycopg://clinica:clinica_dev_only@localhost:5432/"
        "clinica_escola"
    )
    storage_path: Path = Path("./storage")
    environment: str = "development"
    web_origin: str = "http://localhost:5173"
    jwt_secret_key: str = "development-only-change-me"
    jwt_issuer: str = "clinica-escola-api"
    jwt_audience: str = "clinica-escola-web"
    access_token_expires_minutes: int = 30
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 900
    public_query_rate_limit_requests: int = 60
    public_query_rate_limit_window_seconds: int = 60
    public_create_rate_limit_requests: int = 10
    public_create_rate_limit_window_seconds: int = 3600
    public_management_rate_limit_requests: int = 10
    public_management_rate_limit_window_seconds: int = 900
    privacy_notice_version: str = '2026-01'
    demo_master_email: str = "master.demo@demo.clinicaescola.dev"
    demo_master_password: str = "MasterDemo!2026"
    demo_supervisor_email: str = "supervisor.demo@demo.clinicaescola.dev"
    demo_supervisor_password: str = "SupervisorDemo!2026"
    demo_student_email: str = "student.demo@demo.clinicaescola.dev"
    demo_student_password: str = "StudentDemo!2026"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("database_url must use postgresql+psycopg")
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
