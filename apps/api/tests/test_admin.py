from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.db.models import (
    Appointment,
    AppointmentRiskStatus,
    AppointmentSlot,
    SessionAllocation,
    SessionAllocationStatus,
    User,
)
from app.db.session import create_session_factory
from app.main import create_app
from tests.test_scheduling import auth, build_context, create_session, login


@pytest_asyncio.fixture
async def admin_client(tmp_path: Path) -> AsyncClient:
    settings = get_settings().model_copy(update={'storage_path': tmp_path})
    app = create_app(settings)
    async with app.state.session_factory() as session:
        await session.execute(
            text(
                'TRUNCATE appointment_equipment_allocations, appointments, '
                'appointment_slots, session_allocations, clinical_sessions, '
                'document_submissions, document_requirements, '
                'supervisor_service_scopes, service_equipment_requirements, '
                'services, environment_equipments, rooms, equipment_types, '
                'environments, clinics, clinic_term_configs, '
                'supervisor_availabilities, student_availabilities, '
                'student_academic_links, class_blocks, cohorts, disciplines, '
                'courses, academic_terms, supervisors, students, users, '
                'audit_events, app_metadata RESTART IDENTITY CASCADE'
            )
        )
        await session.commit()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://testserver',
    ) as client:
        yield client
    await app.state.engine.dispose()


@pytest.mark.asyncio
async def test_master_dashboard_is_aggregated_and_rbac_protected(
    admin_client: AsyncClient,
) -> None:
    context = await build_context(admin_client)
    clinical_session = await create_session(
        admin_client,
        context['supervisor_token'],
        context,
    )
    session_id = clinical_session['id']
    student_token = await login(
        admin_client,
        'student.schedule.0@example.com',
    )
    allocation = await admin_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )
    assert allocation.status_code == 201, allocation.text
    published = await admin_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 200, published.text

    dashboard = await admin_client.get(
        '/api/v1/admin/dashboard',
        params={'term_id': str(context['term_id'])},
        headers=auth(context['master_token']),
    )
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()['counts']['sessions_total'] == 1
    assert dashboard.json()['counts']['published_sessions'] == 1
    assert dashboard.json()['upcoming_sessions'][0]['capacity_available'] >= 1

    denied = await admin_client.get(
        '/api/v1/admin/dashboard',
        params={'term_id': str(context['term_id'])},
        headers=auth(student_token),
    )
    assert denied.status_code == 403
    assert denied.json()['error']['code'] == 'FORBIDDEN'

    audit = await admin_client.get(
        '/api/v1/audit-events',
        headers=auth(context['master_token']),
    )
    assert audit.status_code == 200, audit.text
    assert any(
        item['action'] == 'SESSION_PUBLISHED'
        for item in audit.json()['items']
    )


@pytest.mark.asyncio
async def test_master_can_deactivate_user_and_revoke_access(
    admin_client: AsyncClient,
) -> None:
    context = await build_context(admin_client)
    app = admin_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        master = await db_session.scalar(
            select(User).where(User.email == context['master_email'])
        )
        assert master is not None
        self_deactivation = await admin_client.post(
            f'/api/v1/users/{master.id}/deactivate',
            headers=auth(context['master_token']),
        )
    assert self_deactivation.status_code == 409
    assert (
        self_deactivation.json()['error']['code']
        == 'SELF_DEACTIVATION_FORBIDDEN'
    )
    supervisor_id = context['supervisor_id']
    response = await admin_client.post(
        f'/api/v1/users/{supervisor_id}/deactivate',
        headers=auth(context['master_token']),
    )
    assert response.status_code == 200, response.text
    assert response.json()['is_active'] is False

    denied_access = await admin_client.get(
        '/api/v1/me',
        headers=auth(context['supervisor_token']),
    )
    assert denied_access.status_code == 401
    assert denied_access.json()['error']['code'] == 'USER_INACTIVE'

    audit = await admin_client.get(
        '/api/v1/audit-events',
        params={
            'action': 'USER_DEACTIVATED',
            'target_type': 'user',
        },
        headers=auth(context['master_token']),
    )
    assert audit.status_code == 200, audit.text
    assert any(
        item['target_id'] == str(context['supervisor_id'])
        for item in audit.json()['items']
    )


@pytest.mark.asyncio
async def test_master_can_consult_at_risk_appointments_without_pii(
    admin_client: AsyncClient,
) -> None:
    context = await build_context(admin_client)
    clinical_session = await create_session(
        admin_client,
        context['supervisor_token'],
        context,
    )
    session_id = clinical_session['id']
    student_token = await login(
        admin_client,
        'student.schedule.0@example.com',
    )
    allocation = await admin_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )
    assert allocation.status_code == 201, allocation.text
    published = await admin_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 200, published.text

    app = admin_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        slot = await db_session.scalar(
            select(AppointmentSlot).where(
                AppointmentSlot.session_id == clinical_session['id']
            )
        )
        assert slot is not None
        booking = await admin_client.post(
            '/api/v1/public/appointments',
            headers={'Idempotency-Key': 'admin-risk-1'},
            json={
                'slot_id': str(slot.id),
                'name': 'Pessoa Demo',
                'email': 'pessoa.demo@example.com',
                'privacy_notice_version': '2026-01',
            },
        )
        assert booking.status_code == 201, booking.text
        appointment = await db_session.get(
            Appointment,
            UUID(booking.json()['id']),
        )
        allocation_row = await db_session.scalar(
            select(SessionAllocation).where(
                SessionAllocation.id == UUID(allocation.json()['id'])
            )
        )
        assert appointment is not None
        assert allocation_row is not None
        appointment.risk_status = AppointmentRiskStatus.AT_RISK.value
        allocation_row.status = SessionAllocationStatus.SUSPENDED.value
        allocation_row.suspended_reason = 'DOCUMENT_REJECTED'
        await db_session.commit()

    risk = await admin_client.get(
        '/api/v1/admin/appointments/at-risk',
        headers=auth(context['master_token']),
    )
    assert risk.status_code == 200, risk.text
    assert risk.json()['total'] == 1
    item = risk.json()['items'][0]
    assert item['cause'] == 'DOCUMENT_REJECTED'
    assert 'public_email' not in item
    assert 'public_name' not in item

    student_risk = await admin_client.get(
        '/api/v1/admin/appointments/at-risk',
        headers=auth(student_token),
    )
    assert student_risk.status_code == 403
