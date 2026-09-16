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
async def clinic_client() -> AsyncClient:
    app = create_app(get_settings())
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        await session.execute(
            text(
                'TRUNCATE clinics, equipment_types, academic_terms, courses, '
                'users, app_metadata RESTART IDENTITY CASCADE'
            )
        )
        await session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://testserver',
    ) as client:
        yield client

    await app.state.engine.dispose()


async def create_user(
    client: AsyncClient,
    *,
    email: str,
    role: Role,
) -> User:
    app = client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    user = User(
        email=email,
        password_hash=hash_password('DemoPassword!2026'),
        role=role.value,
    )
    async with session_factory() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


async def login(client: AsyncClient, email: str) -> str:
    response = await client.post(
        '/api/v1/auth/login',
        json={'email': email, 'password': 'DemoPassword!2026'},
    )
    assert response.status_code == 200
    return response.json()['access_token']


def auth(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


async def create_term(
    client: AsyncClient,
    headers: dict[str, str],
    name: str,
) -> dict[str, Any]:
    response = await client.post(
        '/api/v1/terms',
        headers=headers,
        json={
            'name': name,
            'starts_on': '2026-08-01',
            'ends_on': '2026-12-20',
        },
    )
    assert response.status_code == 201
    return response.json()


async def create_clinic_context(
    client: AsyncClient,
    headers: dict[str, str],
) -> dict[str, Any]:
    clinic = await client.post(
        '/api/v1/clinics',
        headers=headers,
        json={'name': 'Clinica Escola Fisio', 'address_label': 'Unidade central'},
    )
    assert clinic.status_code == 201
    clinic_body = clinic.json()

    environment = await client.post(
        '/api/v1/environments',
        headers=headers,
        json={'clinic_id': clinic_body['id'], 'name': 'Ambulatorio'},
    )
    assert environment.status_code == 201
    environment_body = environment.json()

    equipment = await client.post(
        '/api/v1/equipment-types',
        headers=headers,
        json={'name': 'Maca'},
    )
    assert equipment.status_code == 201
    equipment_body = equipment.json()

    quantity = await client.post(
        '/api/v1/environment-equipments',
        headers=headers,
        json={
            'environment_id': environment_body['id'],
            'equipment_type_id': equipment_body['id'],
            'quantity': 0,
        },
    )
    assert quantity.status_code == 201

    return {
        'clinic': clinic_body,
        'environment': environment_body,
        'equipment': equipment_body,
    }


@pytest.mark.asyncio
async def test_clinic_configuration_isolated_by_term_and_master_only(
    clinic_client: AsyncClient,
) -> None:
    master = await create_user(
        clinic_client, email='master.clinic@example.com', role=Role.MASTER
    )
    student = await create_user(
        clinic_client, email='student.clinic@example.com', role=Role.STUDENT
    )
    master_headers = auth(await login(clinic_client, master.email))
    student_headers = auth(await login(clinic_client, student.email))
    context = await create_clinic_context(clinic_client, master_headers)
    first_term = await create_term(clinic_client, master_headers, '2026.1')
    second_term = await create_term(clinic_client, master_headers, '2026.2')

    first_config = await clinic_client.post(
        '/api/v1/clinic-term-configs',
        headers=master_headers,
        json={
            'clinic_id': context['clinic']['id'],
            'term_id': first_term['id'],
            'max_simultaneous_appointments': 2,
            'max_students': 4,
        },
    )
    second_config = await clinic_client.post(
        '/api/v1/clinic-term-configs',
        headers=master_headers,
        json={
            'clinic_id': context['clinic']['id'],
            'term_id': second_term['id'],
            'max_simultaneous_appointments': 3,
            'max_students': 6,
        },
    )
    assert first_config.status_code == second_config.status_code == 201
    assert first_config.json()['term_id'] != second_config.json()['term_id']

    invalid_limit = await clinic_client.post(
        '/api/v1/clinic-term-configs',
        headers=master_headers,
        json={
            'clinic_id': context['clinic']['id'],
            'term_id': first_term['id'],
            'max_simultaneous_appointments': 0,
            'max_students': 4,
        },
    )
    assert invalid_limit.status_code == 422
    assert invalid_limit.json()['error']['code'] == 'VALIDATION_ERROR'

    denied = await clinic_client.post(
        '/api/v1/clinics',
        headers=student_headers,
        json={'name': 'Nao permitido', 'address_label': 'Unidade'},
    )
    assert denied.status_code == 403
    assert denied.json()['error']['code'] == 'FORBIDDEN'


@pytest.mark.asyncio
async def test_inactive_resources_cannot_enter_new_configuration(
    clinic_client: AsyncClient,
) -> None:
    master = await create_user(
        clinic_client, email='master.inactive@example.com', role=Role.MASTER
    )
    headers = auth(await login(clinic_client, master.email))
    context = await create_clinic_context(clinic_client, headers)
    equipment_id = context['equipment']['id']
    environment_id = context['environment']['id']

    deactivated_equipment = await clinic_client.post(
        f'/api/v1/equipment-types/{equipment_id}/deactivate',
        headers=headers,
    )
    assert deactivated_equipment.status_code == 200

    rejected_equipment = await clinic_client.post(
        '/api/v1/environment-equipments',
        headers=headers,
        json={
            'environment_id': context['environment']['id'],
            'equipment_type_id': context['equipment']['id'],
            'quantity': 2,
        },
    )
    assert rejected_equipment.status_code == 422
    assert rejected_equipment.json()['error']['code'] == 'RESOURCE_INACTIVE'

    deactivated_environment = await clinic_client.post(
        f'/api/v1/environments/{environment_id}/deactivate',
        headers=headers,
    )
    assert deactivated_environment.status_code == 200

    rejected_room = await clinic_client.post(
        '/api/v1/rooms',
        headers=headers,
        json={
            'environment_id': context['environment']['id'],
            'name': 'Sala bloqueada',
        },
    )
    assert rejected_room.status_code == 422
    assert rejected_room.json()['error']['code'] == 'RESOURCE_INACTIVE'


@pytest.mark.asyncio
async def test_services_and_supervisor_scopes_validate_active_references(
    clinic_client: AsyncClient,
) -> None:
    master = await create_user(
        clinic_client, email='master.scope@example.com', role=Role.MASTER
    )
    supervisor = await create_user(
        clinic_client, email='supervisor.scope@example.com', role=Role.SUPERVISOR
    )
    headers = auth(await login(clinic_client, master.email))
    context = await create_clinic_context(clinic_client, headers)
    term = await create_term(clinic_client, headers, '2026.2')
    equipment_id = context['equipment']['id']

    course = await clinic_client.post(
        '/api/v1/courses',
        headers=headers,
        json={'name': 'Fisioterapia', 'code': 'FISIO'},
    )
    assert course.status_code == 201
    discipline = await clinic_client.post(
        '/api/v1/disciplines',
        headers=headers,
        json={
            'course_id': course.json()['id'],
            'name': 'Pratica supervisionada',
            'code': 'FISIO-PS',
            'kind': 'INTERNSHIP',
        },
    )
    assert discipline.status_code == 201

    profile = await clinic_client.post(
        '/api/v1/supervisors',
        headers=headers,
        json={
            'user_id': str(supervisor.id),
            'kind': 'PROFESSOR',
            'full_name': 'Supervisor Demo',
            'professional_area': 'Fisioterapia',
            'max_students_default': 4,
        },
    )
    assert profile.status_code == 201

    invalid_duration = await clinic_client.post(
        '/api/v1/services',
        headers=headers,
        json={
            'discipline_id': discipline.json()['id'],
            'name': 'Avaliacao',
            'duration_minutes': 0,
        },
    )
    assert invalid_duration.status_code == 422
    assert invalid_duration.json()['error']['code'] == 'VALIDATION_ERROR'

    service = await clinic_client.post(
        '/api/v1/services',
        headers=headers,
        json={
            'discipline_id': discipline.json()['id'],
            'name': 'Avaliacao',
            'duration_minutes': 60,
        },
    )
    assert service.status_code == 201

    await clinic_client.post(
        f'/api/v1/equipment-types/{equipment_id}/deactivate',
        headers=headers,
    )
    inactive_requirement = await clinic_client.post(
        '/api/v1/service-equipment-requirements',
        headers=headers,
        json={
            'service_id': service.json()['id'],
            'equipment_type_id': context['equipment']['id'],
            'units_per_appointment': 1,
        },
    )
    assert inactive_requirement.status_code == 422
    assert inactive_requirement.json()['error']['code'] == 'RESOURCE_INACTIVE'

    scope = await clinic_client.post(
        '/api/v1/supervisor-service-scopes',
        headers=headers,
        json={
            'supervisor_id': str(supervisor.id),
            'term_id': term['id'],
            'service_id': service.json()['id'],
            'environment_id': context['environment']['id'],
            'can_review_documents': True,
            'max_students_override': 2,
        },
    )
    assert scope.status_code == 201
    assert scope.json()['max_students_override'] == 2
