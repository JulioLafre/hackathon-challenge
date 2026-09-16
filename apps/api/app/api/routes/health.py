from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import ping_database

router = APIRouter(prefix="/health", tags=["health"])


class LiveHealthResponse(BaseModel):
    status: Literal["ok"]


class ReadinessHealthResponse(BaseModel):
    status: Literal["ok", "error"]
    checks: dict[str, Literal["ok", "error"]]


def _storage_is_ready(storage_path: Path) -> bool:
    if not storage_path.is_dir():
        return False

    try:
        with NamedTemporaryFile(dir=storage_path, prefix=".health-"):
            return True
    except OSError:
        return False


@router.get("/live", response_model=LiveHealthResponse)
async def live_health() -> LiveHealthResponse:
    return LiveHealthResponse(status="ok")


@router.get("/ready", response_model=ReadinessHealthResponse)
async def ready_health(request: Request) -> JSONResponse:
    database_status: Literal["ok", "error"] = "ok"
    try:
        await ping_database(request.app.state.engine)
    except SQLAlchemyError:
        database_status = "error"

    storage_status: Literal["ok", "error"] = (
        "ok" if _storage_is_ready(request.app.state.settings.storage_path) else "error"
    )
    is_ready = database_status == "ok" and storage_status == "ok"
    payload = ReadinessHealthResponse(
        status="ok" if is_ready else "error",
        checks={"database": database_status, "storage": storage_status},
    )
    return JSONResponse(
        status_code=200 if is_ready else 503,
        content=payload.model_dump(),
    )
