from __future__ import annotations

from importlib import import_module
from pathlib import Path

import pytest


def _load_settings() -> type:
    try:
        return import_module("app.core.config").Settings
    except ModuleNotFoundError as exc:
        pytest.fail(f"API settings are not available: {exc}", pytrace=False)


def test_settings_are_loaded_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://service:development@db:5432/clinic",
    )
    monkeypatch.setenv("STORAGE_PATH", "/srv/private-storage")
    monkeypatch.setenv("ENVIRONMENT", "test")

    settings = _load_settings()()

    assert settings.database_url == (
        "postgresql+psycopg://service:development@db:5432/clinic"
    )
    assert settings.storage_path == Path("/srv/private-storage")
    assert settings.environment == "test"


def test_settings_reject_non_psycopg_database_urls() -> None:
    settings_type = _load_settings()

    with pytest.raises(ValueError, match=r"postgresql\+psycopg"):
        settings_type(database_url="sqlite+aiosqlite:///./test.db")
