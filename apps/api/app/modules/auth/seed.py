import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, get_settings
from app.core.security import hash_password
from app.db.models import Role, User
from app.db.session import create_engine, create_session_factory


async def seed_users(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
) -> None:
    demo_users = (
        (settings.demo_master_email, settings.demo_master_password, Role.MASTER),
        (
            settings.demo_supervisor_email,
            settings.demo_supervisor_password,
            Role.SUPERVISOR,
        ),
        (settings.demo_student_email, settings.demo_student_password, Role.STUDENT),
    )
    async with session_factory.begin() as session:
        for email, password, role in demo_users:
            normalized_email = email.strip().lower()
            user = await session.scalar(
                select(User).where(User.email == normalized_email)
            )
            if user is None:
                session.add(
                    User(
                        email=normalized_email,
                        password_hash=hash_password(password),
                        role=role.value,
                        is_active=True,
                    )
                )
                continue

            user.password_hash = hash_password(password)
            user.role = role.value
            user.is_active = True


async def run_seed() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    try:
        await seed_users(session_factory, settings)
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
