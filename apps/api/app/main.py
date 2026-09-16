from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.academics import router as academics_router
from app.api.routes.auth import me_router
from app.api.routes.auth import router as auth_router
from app.api.routes.clinics import router as clinics_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, api_error_handler, validation_error_handler
from app.db.session import create_engine, create_session_factory
from app.modules.auth.rate_limit import LoginRateLimiter


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    storage_path = app.state.settings.storage_path
    if not storage_path.exists():
        storage_path.mkdir(parents=True)
    yield
    await app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(
        title="Clinica Escola API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.engine = create_engine(resolved_settings)
    app.state.session_factory = create_session_factory(app.state.engine)
    app.state.login_rate_limiter = LoginRateLimiter(
        max_attempts=resolved_settings.login_rate_limit_attempts,
        window_seconds=resolved_settings.login_rate_limit_window_seconds,
    )
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[resolved_settings.web_origin],
        allow_credentials=False,
        allow_methods=['GET', 'POST', 'PATCH', 'PUT'],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def request_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(me_router, prefix="/api/v1")
    app.include_router(academics_router, prefix="/api/v1")
    app.include_router(clinics_router, prefix="/api/v1")
    app.include_router(documents_router, prefix='/api/v1')
    return app


app = create_app()
