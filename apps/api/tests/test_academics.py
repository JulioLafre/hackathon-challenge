from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import Role, User
from app.db.session import create_session_factory
from app.main import create_app


@pytest_asyncio.fixture
async def academic_client() -> AsyncClient:
    app = create_app(get_settings())
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        await session.execute(
            text(
                'TRUNCATE academic_terms, courses, users, app_metadata '
                'RESTART IDENTITY CASCADE'
            )
        )
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
    email: str,
    role: Role,
    password: str = "DemoPassword!2026",
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


async def login(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "DemoPassword!2026"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def create_term(
    client: AsyncClient,
    headers: dict[str, str],
    name: str = "2026.2",
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/terms",
        headers=headers,
        json={
            "name": name,
            "starts_on": "2026-08-01",
            "ends_on": "2026-12-20",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_master_activation_is_exclusive_and_student_cannot_mutate_catalog(
    academic_client: AsyncClient,
) -> None:
    master = await create_user(
        academic_client,
        email="master.academic@example.com",
        role=Role.MASTER,
    )
    student = await create_user(
        academic_client,
        email="student.academic@example.com",
        role=Role.STUDENT,
    )
    master_headers = auth(await login(academic_client, master.email))
    student_headers = auth(await login(academic_client, student.email))

    first = await create_term(academic_client, master_headers, "2026.1")
    second = await create_term(academic_client, master_headers, "2026.2")
    assert (
        await academic_client.post(
            f"/api/v1/terms/{first['id']}/activate", headers=master_headers
        )
    ).status_code == 200
    assert (
        await academic_client.post(
            f"/api/v1/terms/{second['id']}/activate", headers=master_headers
        )
    ).status_code == 200

    terms = (await academic_client.get("/api/v1/terms", headers=master_headers)).json()
    statuses = {term["name"]: term["status"] for term in terms}
    assert statuses == {"2026.1": "CLOSED", "2026.2": "ACTIVE"}

    denied = await academic_client.post(
        "/api/v1/terms",
        headers=student_headers,
        json={
            "name": "2027.1",
            "starts_on": "2027-01-01",
            "ends_on": "2027-06-30",
        },
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_master_builds_grade_and_term_deactivation_preserves_student_link(
    academic_client: AsyncClient,
) -> None:
    master = await create_user(
        academic_client,
        email="master.grade@example.com",
        role=Role.MASTER,
    )
    student = await create_user(
        academic_client,
        email="student.grade@example.com",
        role=Role.STUDENT,
    )
    headers = auth(await login(academic_client, master.email))
    term = await create_term(academic_client, headers)

    course_response = await academic_client.post(
        "/api/v1/courses",
        headers=headers,
        json={"name": "Fisioterapia", "code": "FISIO"},
    )
    assert course_response.status_code == 201
    course = course_response.json()

    discipline_response = await academic_client.post(
        "/api/v1/disciplines",
        headers=headers,
        json={
            "course_id": course["id"],
            "name": "Prática supervisionada",
            "code": "FISIO-PS",
            "kind": "INTERNSHIP",
        },
    )
    assert discipline_response.status_code == 201
    discipline = discipline_response.json()

    cohort_response = await academic_client.post(
        "/api/v1/cohorts",
        headers=headers,
        json={
            "term_id": term["id"],
            "course_id": course["id"],
            "period": 5,
            "label": "FISIO-5A",
        },
    )
    assert cohort_response.status_code == 201
    cohort = cohort_response.json()

    block = await academic_client.post(
        "/api/v1/class-blocks",
        headers=headers,
        json={
            "cohort_id": cohort["id"],
            "discipline_id": discipline["id"],
            "weekday": 1,
            "start_time": "09:00",
            "end_time": "10:00",
        },
    )
    assert block.status_code == 201

    profile = await academic_client.post(
        "/api/v1/students",
        headers=headers,
        json={
            "user_id": str(student.id),
            "registration": "FISIO-DEMO-001",
            "full_name": "Estudante Demo",
        },
    )
    assert profile.status_code == 201

    link = await academic_client.post(
        "/api/v1/student-academic-links",
        headers=headers,
        json={
            "student_id": str(student.id),
            "term_id": term["id"],
            "cohort_id": cohort["id"],
            "discipline_id": discipline["id"],
        },
    )
    assert link.status_code == 201
    link_id = link.json()["id"]

    activated = await academic_client.post(
        '/api/v1/terms/{}/activate'.format(term['id']), headers=headers
    )
    assert activated.status_code == 200

    deactivated = await academic_client.post(
        f"/api/v1/terms/{term['id']}/deactivate", headers=headers
    )
    assert deactivated.status_code == 200

    links = await academic_client.get(
        "/api/v1/student-academic-links",
        headers=headers,
        params={"student_id": str(student.id)},
    )
    assert links.status_code == 200
    assert links.json()[0]["id"] == link_id
    assert links.json()[0]["term_status"] == "CLOSED"


@pytest.mark.asyncio
async def test_weekly_intervals_reject_overlap_but_allow_touching_boundary(
    academic_client: AsyncClient,
) -> None:
    master = await create_user(
        academic_client,
        email="master.blocks@example.com",
        role=Role.MASTER,
    )
    headers = auth(await login(academic_client, master.email))
    term = await create_term(academic_client, headers)
    course = (
        await academic_client.post(
            "/api/v1/courses",
            headers=headers,
            json={"name": "Fisioterapia", "code": "FISIO"},
        )
    ).json()
    cohort = (
        await academic_client.post(
            "/api/v1/cohorts",
            headers=headers,
            json={
                "term_id": term["id"],
                "course_id": course["id"],
                "period": 5,
                "label": "FISIO-5A",
            },
        )
    ).json()

    first = await academic_client.post(
        "/api/v1/class-blocks",
        headers=headers,
        json={
            "cohort_id": cohort["id"],
            "weekday": 1,
            "start_time": "09:00",
            "end_time": "10:00",
        },
    )
    assert first.status_code == 201

    touching = await academic_client.post(
        "/api/v1/class-blocks",
        headers=headers,
        json={
            "cohort_id": cohort["id"],
            "weekday": 1,
            "start_time": "10:00",
            "end_time": "11:00",
        },
    )
    assert touching.status_code == 201

    overlap = await academic_client.post(
        "/api/v1/class-blocks",
        headers=headers,
        json={
            "cohort_id": cohort["id"],
            "weekday": 1,
            "start_time": "09:30",
            "end_time": "10:30",
        },
    )
    assert overlap.status_code == 409
    assert overlap.json()["error"]["code"] == "ACADEMIC_INTERVAL_CONFLICT"

    invalid_timezone = await academic_client.post(
        "/api/v1/class-blocks",
        headers=headers,
        json={
            "cohort_id": cohort["id"],
            "weekday": 2,
            "start_time": "09:00",
            "end_time": "10:00",
            "time_zone": "UTC",
        },
    )
    assert invalid_timezone.status_code == 422


@pytest.mark.asyncio
async def test_student_and_supervisor_manage_only_their_own_weekly_availability(
    academic_client: AsyncClient,
) -> None:
    master = await create_user(
        academic_client,
        email="master.availability@example.com",
        role=Role.MASTER,
    )
    student = await create_user(
        academic_client,
        email="student.availability@example.com",
        role=Role.STUDENT,
    )
    supervisor = await create_user(
        academic_client,
        email="supervisor.availability@example.com",
        role=Role.SUPERVISOR,
    )
    master_headers = auth(await login(academic_client, master.email))
    student_headers = auth(await login(academic_client, student.email))
    supervisor_headers = auth(await login(academic_client, supervisor.email))
    term = await create_term(academic_client, master_headers)

    student_profile = await academic_client.post(
        "/api/v1/students",
        headers=master_headers,
        json={
            "user_id": str(student.id),
            "registration": "FISIO-AV-001",
            "full_name": "Estudante Disponível",
        },
    )
    assert student_profile.status_code == 201
    supervisor_profile = await academic_client.post(
        "/api/v1/supervisors",
        headers=master_headers,
        json={
            "user_id": str(supervisor.id),
            "kind": "PRECEPTOR",
            "full_name": "Supervisor Disponível",
            "professional_area": "Fisioterapia",
            "max_students_default": 4,
        },
    )
    assert supervisor_profile.status_code == 201

    student_update = await academic_client.put(
        "/api/v1/me/availability",
        headers=student_headers,
        json={
            "term_id": term["id"],
            "intervals": [
                {
                    "weekday": 2,
                    "start_time": "08:00",
                    "end_time": "10:00",
                }
            ],
        },
    )
    assert student_update.status_code == 200
    assert student_update.json()["owner_type"] == "STUDENT"

    supervisor_update = await academic_client.put(
        "/api/v1/me/availability",
        headers=supervisor_headers,
        json={
            "term_id": term["id"],
            "intervals": [
                {
                    "weekday": 2,
                    "start_time": "10:00",
                    "end_time": "12:00",
                }
            ],
        },
    )
    assert supervisor_update.status_code == 200
    assert supervisor_update.json()["owner_type"] == "SUPERVISOR"

    overlap = await academic_client.put(
        "/api/v1/me/availability",
        headers=student_headers,
        json={
            "term_id": term["id"],
            "intervals": [
                {
                    "weekday": 2,
                    "start_time": "09:00",
                    "end_time": "11:00",
                },
                {
                    "weekday": 2,
                    "start_time": "10:30",
                    "end_time": "11:30",
                },
            ],
        },
    )
    assert overlap.status_code == 409
    assert overlap.json()["error"]["code"] == "ACADEMIC_INTERVAL_CONFLICT"
