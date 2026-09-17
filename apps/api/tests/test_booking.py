import asyncio
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.db.models import (
    Appointment,
    AppointmentEquipmentAllocation,
    AppointmentSlot,
)
from app.db.session import create_session_factory
from app.main import create_app
from tests.test_scheduling import (
    auth,
    build_context,
    create_session,
    login,
)


@pytest_asyncio.fixture
async def booking_client(tmp_path: Path) -> AsyncClient:
    settings = get_settings().model_copy(update={'storage_path': tmp_path})
    app = create_app(settings)
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
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


async def publish_one_slot(client: AsyncClient) -> tuple[dict[str, object], UUID]:
    context = await build_context(client, room_count=1, equipment_quantity=1)
    clinical_session = await create_session(
        client,
        context['supervisor_token'],
        context,
    )
    session_id = clinical_session['id']
    student_token = await login(client, 'student.schedule.0@example.com')
    allocation = await client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )
    assert allocation.status_code == 201, allocation.text
    published = await client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 200, published.text

    session_factory = create_session_factory(client._transport.app.state.engine)  # type: ignore[attr-defined]
    async with session_factory() as db_session:
        slot = await db_session.scalar(
            select(AppointmentSlot).where(
                AppointmentSlot.session_id == UUID(str(clinical_session['id']))
            )
        )
        assert slot is not None
        return context, slot.id


def public_payload(slot_id: UUID) -> dict[str, object]:
    return {
        'slot_id': str(slot_id),
        'name': 'Pessoa Demo',
        'email': 'pessoa.demo@example.com',
        'privacy_notice_version': '2026-01',
    }


@pytest.mark.asyncio
async def test_public_catalog_only_returns_available_slots(
    booking_client: AsyncClient,
) -> None:
    context, slot_id = await publish_one_slot(booking_client)

    services = await booking_client.get('/api/v1/public/services')
    assert services.status_code == 200, services.text
    assert services.json()[0]['id'] == str(context['service_id'])
    assert 'supervisor_id' not in services.json()[0]

    slots = await booking_client.get(
        '/api/v1/public/slots',
        params={
            'service_id': str(context['service_id']),
            'from': '2026-10-06T00:00:00Z',
            'to': '2026-10-07T00:00:00Z',
        },
    )
    assert slots.status_code == 200, slots.text
    assert [item['id'] for item in slots.json()] == [str(slot_id)]
    assert 'student_id' not in slots.json()[0]
    assert 'supervisor_id' not in slots.json()[0]


@pytest.mark.asyncio
async def test_last_public_slot_is_serialized_under_concurrency(
    booking_client: AsyncClient,
) -> None:
    _, slot_id = await publish_one_slot(booking_client)

    responses = await asyncio.gather(
        booking_client.post(
            '/api/v1/public/appointments',
            headers={'Idempotency-Key': 'booking-race-a'},
            json=public_payload(slot_id),
        ),
        booking_client.post(
            '/api/v1/public/appointments',
            headers={'Idempotency-Key': 'booking-race-b'},
            json={**public_payload(slot_id), 'email': 'outra.demo@example.com'},
        ),
    )

    assert sorted(response.status_code for response in responses) == [201, 409]
    loser = next(response for response in responses if response.status_code == 409)
    assert loser.json()['error']['code'] == 'SLOT_FULL'

    app = booking_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        slot = await db_session.get(AppointmentSlot, slot_id)
        assert slot is not None
        assert slot.reserved_count == 1
        count = await db_session.scalar(
            select(text('count(*)')).select_from(Appointment)
        )
        assert count == 1


@pytest.mark.asyncio
async def test_idempotency_returns_original_without_new_count(
    booking_client: AsyncClient,
) -> None:
    _, slot_id = await publish_one_slot(booking_client)
    payload = public_payload(slot_id)

    first = await booking_client.post(
        '/api/v1/public/appointments',
        headers={'Idempotency-Key': 'booking-retry-1'},
        json=payload,
    )
    repeated = await booking_client.post(
        '/api/v1/public/appointments',
        headers={'Idempotency-Key': 'booking-retry-1'},
        json=payload,
    )

    assert first.status_code == 201, first.text
    assert repeated.status_code == 200, repeated.text
    assert repeated.json()['id'] == first.json()['id']
    assert repeated.json()['management_code'] is None

    app = booking_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        appointment = await db_session.get(
            Appointment, UUID(first.json()['id'])
        )
        assert appointment is not None
        assert appointment.management_token_hash != first.json()['management_code']
        assert appointment.idempotency_key == 'booking-retry-1'


@pytest.mark.asyncio
async def test_confirm_cancel_releases_slot_and_rejects_late_management(
    booking_client: AsyncClient,
) -> None:
    _, slot_id = await publish_one_slot(booking_client)
    created = await booking_client.post(
        '/api/v1/public/appointments',
        headers={'Idempotency-Key': 'booking-manage-1'},
        json=public_payload(slot_id),
    )
    assert created.status_code == 201, created.text
    appointment_id = created.json()['id']
    management_code = created.json()['management_code']

    confirmed = await booking_client.post(
        '/api/v1/public/appointments/confirm',
        json={
            'appointment_id': appointment_id,
            'management_code': management_code,
        },
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()['status'] == 'CONFIRMED'

    cancelled = await booking_client.post(
        '/api/v1/public/appointments/cancel',
        json={
            'appointment_id': appointment_id,
            'management_code': management_code,
        },
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()['status'] == 'CANCELLED'

    replacement = await booking_client.post(
        '/api/v1/public/appointments',
        headers={'Idempotency-Key': 'booking-manage-2'},
        json={**public_payload(slot_id), 'phone': '+5511999999999'},
    )
    assert replacement.status_code == 201, replacement.text

    app = booking_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        slot = await db_session.get(AppointmentSlot, slot_id)
        assert slot is not None
        assert slot.reserved_count == 1
        active_equipment = await db_session.scalar(
            select(text('count(*)'))
            .select_from(AppointmentEquipmentAllocation)
            .join(Appointment)
            .where(Appointment.status.in_(['BOOKED', 'CONFIRMED']))
        )
        assert active_equipment == 1

    async with session_factory() as db_session:
        slot = await db_session.get(AppointmentSlot, slot_id)
        assert slot is not None
        slot.starts_at = datetime.now(UTC)
        await db_session.commit()

    late_cancel = await booking_client.post(
        '/api/v1/public/appointments/cancel',
        json={
            'appointment_id': replacement.json()['id'],
            'management_code': replacement.json()['management_code'],
        },
    )
    assert late_cancel.status_code == 409
    assert late_cancel.json()['error']['code'] == 'INVALID_STATE_TRANSITION'
