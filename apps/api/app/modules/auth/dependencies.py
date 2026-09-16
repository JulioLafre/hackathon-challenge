from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.db.models import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        await session.close()


async def get_current_user(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    if credentials is None:
        raise ApiError(401, "INVALID_TOKEN", "Token inválido ou expirado.")

    try:
        payload = decode_access_token(
            credentials.credentials, request.app.state.settings
        )
        user_id = UUID(str(payload["sub"]))
    except Exception:
        raise ApiError(401, "INVALID_TOKEN", "Token inválido ou expirado.") from None

    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise ApiError(401, "INVALID_TOKEN", "Token inválido ou expirado.")
    if not user.is_active:
        raise ApiError(401, "USER_INACTIVE", "Usuário desativado.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[..., Awaitable[User]]:
    allowed_roles = {role.value for role in roles}

    async def dependency(current_user: CurrentUser) -> User:
        if current_user.role not in allowed_roles:
            raise ApiError(
                403,
                "FORBIDDEN",
                "Você não tem permissão para esta operação.",
            )
        return current_user

    return dependency


def ensure_owner(current_user: User, owner_id: UUID) -> None:
    if current_user.id != owner_id:
        raise ApiError(404, "NOT_FOUND", "Recurso não encontrado.")
