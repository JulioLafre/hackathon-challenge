from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app


async def _successful_database_ping(_engine: object) -> None:
    return None


@pytest.mark.asyncio
async def test_live_health_reports_that_the_process_is_alive(tmp_path: Path) -> None:
    app = create_app(
        Settings(
            database_url="postgresql+psycopg://test:test@localhost:5432/test",
            storage_path=tmp_path,
        )
    )

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_ready_health_reports_database_and_storage_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.routes.health.ping_database", _successful_database_ping
    )
    app = create_app(
        Settings(
            database_url="postgresql+psycopg://test:test@localhost:5432/test",
            storage_path=tmp_path,
        )
    )

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "storage": "ok"},
    }


@pytest.mark.asyncio
async def test_ready_health_returns_service_unavailable_when_storage_is_not_writable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.routes.health.ping_database", _successful_database_ping
    )
    storage_path = tmp_path / "storage-file"
    storage_path.write_text("not a directory")
    app = create_app(
        Settings(
            database_url="postgresql+psycopg://test:test@localhost:5432/test",
            storage_path=storage_path,
        )
    )

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "checks": {"database": "ok", "storage": "error"},
    }
