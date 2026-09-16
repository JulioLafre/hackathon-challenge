from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.core.security import (
    create_access_token,
    dummy_password_hash,
    verify_password,
)
from app.db.models import User
from app.modules.auth.dependencies import CurrentUser, get_db_session
from app.modules.auth.rate_limit import LoginRateLimiter
from app.modules.auth.schemas import LoginRequest, LoginResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["auth"])


def get_login_rate_limiter(request: Request) -> LoginRateLimiter:
    return cast(LoginRateLimiter, request.app.state.login_rate_limiter)


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    limiter: Annotated[LoginRateLimiter, Depends(get_login_rate_limiter)],
) -> LoginResponse:
    client_key = request.client.host if request.client else "unknown"
    retry_after = limiter.retry_after(client_key)
    if retry_after is not None:
        raise ApiError(
            429,
            "LOGIN_RATE_LIMITED",
            "Muitas tentativas de login. Tente novamente mais tarde.",
            headers={"Retry-After": str(retry_after)},
        )

    normalized_email = str(payload.email).strip().lower()
    user = await session.scalar(select(User).where(User.email == normalized_email))
    password_hash = user.password_hash if user is not None else dummy_password_hash
    password_is_valid = verify_password(payload.password, password_hash)
    if user is None or not user.is_active or not password_is_valid:
        limiter.record_failure(client_key)
        raise ApiError(
            401,
            "INVALID_CREDENTIALS",
            "E-mail ou senha inválidos.",
        )

    limiter.reset(client_key)
    token = create_access_token(user, request.app.state.settings)
    return LoginResponse(
        access_token=token,
        expires_in=request.app.state.settings.access_token_expires_minutes * 60,
        user=UserProfile.model_validate(user),
    )


@me_router.get("/me", response_model=UserProfile)
async def current_user(current_user: CurrentUser) -> UserProfile:
    return UserProfile.model_validate(current_user)
