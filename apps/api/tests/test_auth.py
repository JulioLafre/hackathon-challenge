from datetime import timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password
from app.db.models import Role, User
from app.db.session import create_session_factory
from app.main import create_app
from app.modules.auth.dependencies import ensure_owner, require_roles
from app.modules.auth.seed import seed_users


@pytest_asyncio.fixture
async def auth_client() -> AsyncClient:
    settings = get_settings()
    app = create_app(settings)
    test_router = APIRouter()

    @test_router.get(
        "/test/master-only",
        dependencies=[Depends(require_roles(Role.MASTER))],
    )
    async def master_only_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(test_router, prefix="/api/v1")
    session_factory = create_session_factory(app.state.engine)

    async with session_factory() as session:
        await session.execute(delete(User))
        await session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client

    await app.state.engine.dispose()


async def create_user(
    client: AsyncClient,
    *,
    email: str = "student@example.com",
    password: str = "StudentDemo!2026",
    role: Role = Role.STUDENT,
) -> User:
    app = client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role.value,
    )
    async with session_factory() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


async def login(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


@pytest.mark.asyncio
async def test_invalid_credentials_have_same_safe_error(
    auth_client: AsyncClient,
) -> None:
    await create_user(auth_client)

    wrong_password = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "wrong-password"},
    )
    unknown_email = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "wrong-password"},
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    wrong_error = wrong_password.json()["error"]
    unknown_error = unknown_email.json()["error"]
    assert {
        key: wrong_error[key] for key in ("code", "message", "details")
    } == {
        key: unknown_error[key] for key in ("code", "message", "details")
    }
    assert wrong_error["code"] == "INVALID_CREDENTIALS"
    assert "password_hash" not in wrong_password.text


@pytest.mark.asyncio
async def test_login_returns_short_token_and_me_hides_sensitive_fields(
    auth_client: AsyncClient,
) -> None:
    user = await create_user(auth_client)

    body = await login(auth_client, "student@example.com", "StudentDemo!2026")
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 1800
    assert body["user"]["id"] == str(user.id)
    assert "password_hash" not in body

    me = await auth_client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "student@example.com"
    assert "access_token" not in me.text
    assert "password_hash" not in me.text


@pytest.mark.asyncio
async def test_expired_and_deactivated_tokens_are_rejected(
    auth_client: AsyncClient,
) -> None:
    user = await create_user(auth_client)
    settings = get_settings()
    expired_token = create_access_token(
        user,
        settings,
        expires_delta=timedelta(seconds=-1),
    )

    expired = await auth_client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "INVALID_TOKEN"

    active_token = create_access_token(user, settings)
    app = auth_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        database_user = await session.get(User, user.id)
        assert database_user is not None
        database_user.is_active = False
        await session.commit()

    deactivated = await auth_client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {active_token}"},
    )
    assert deactivated.status_code == 401
    assert deactivated.json()["error"]["code"] == "USER_INACTIVE"


@pytest.mark.asyncio
async def test_sixth_failed_login_is_rate_limited(auth_client: AsyncClient) -> None:
    for _ in range(5):
        response = await auth_client.post(
            "/api/v1/auth/login",
            json={"email": "unknown@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    limited = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "wrong-password"},
    )
    assert limited.status_code == 429
    assert limited.headers["retry-after"]
    assert limited.json()["error"]["code"] == "LOGIN_RATE_LIMITED"


@pytest.mark.asyncio
async def test_student_is_denied_by_master_only_dependency(
    auth_client: AsyncClient,
) -> None:
    await create_user(auth_client)
    token = (
        await login(auth_client, "student@example.com", "StudentDemo!2026")
    )["access_token"]

    denied = await auth_client.get(
        "/api/v1/test/master-only",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_object_scope_hides_resource_owned_by_another_user(
    auth_client: AsyncClient,
) -> None:
    user = await create_user(auth_client)

    with pytest.raises(ApiError) as error:
        ensure_owner(user, uuid4())

    assert error.value.status_code == 404
    assert error.value.code == "NOT_FOUND"


@pytest.mark.asyncio
async def test_seed_is_idempotent(auth_client: AsyncClient) -> None:
    app = auth_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    settings = get_settings()

    await seed_users(session_factory, settings)
    await seed_users(session_factory, settings)

    async with session_factory() as session:
        users = (await session.execute(select(User))).scalars().all()

    assert len(users) == 3
    assert {user.role for user in users} == {
        Role.MASTER.value,
        Role.SUPERVISOR.value,
        Role.STUDENT.value,
    }
