from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import (
    AcademicTerm,
    Appointment,
    AppointmentSlot,
    ClassBlock,
    Clinic,
    ClinicalService,
    ClinicTermConfig,
    Cohort,
    Course,
    Discipline,
    DocumentRequirement,
    DocumentSubmission,
    DocumentSubmissionStatus,
    Environment,
    EnvironmentEquipment,
    EquipmentType,
    Room,
    ServiceEquipmentRequirement,
    SessionAllocation,
    SessionAllocationStatus,
    Student,
    StudentAcademicLink,
    StudentAvailability,
    Supervisor,
    SupervisorAvailability,
    SupervisorServiceScope,
    User,
)
from app.db.session import create_session_factory
from app.main import create_app

PASSWORD = 'DemoPassword!2026'
STARTS_AT = datetime(2026, 10, 6, 11, 30, tzinfo=UTC)
ENDS_AT = datetime(2026, 10, 6, 12, 30, tzinfo=UTC)


@pytest_asyncio.fixture
async def scheduling_client(tmp_path: Path) -> AsyncClient:
    settings = get_settings().model_copy(update={'storage_path': tmp_path})
    app = create_app(settings)
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        await session.execute(
            text(
                'TRUNCATE appointment_slots, session_allocations, '
                'clinical_sessions, document_submissions, document_requirements, '
                'supervisor_service_scopes, service_equipment_requirements, '
                'services, environment_equipments, rooms, equipment_types, '
                'environments, clinics, clinic_term_configs, '
                'supervisor_availabilities, student_availabilities, '
                'student_academic_links, class_blocks, cohorts, disciplines, '
                'courses, academic_terms, supervisors, students, users, '
                'app_metadata RESTART IDENTITY CASCADE'
            )
        )
        await session.commit()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://testserver',
    ) as client:
        yield client
    await app.state.engine.dispose()


async def login(client: AsyncClient, email: str) -> str:
    response = await client.post(
        '/api/v1/auth/login',
        json={'email': email, 'password': PASSWORD},
    )
    assert response.status_code == 200
    return response.json()['access_token']


def auth(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


async def build_context(
    client: AsyncClient,
    *,
    student_count: int = 1,
    supervisor_limit: int = 4,
    room_count: int = 2,
    equipment_quantity: int = 3,
    class_block: bool = False,
    document_required: bool = False,
) -> dict[str, Any]:
    app = client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    ids: dict[str, Any] = {}
    async with session_factory() as session:
        master = User(
            email='master.schedule@example.com',
            password_hash=hash_password(PASSWORD),
            role='MASTER',
        )
        supervisor_user = User(
            email='supervisor.schedule@example.com',
            password_hash=hash_password(PASSWORD),
            role='SUPERVISOR',
        )
        session.add_all([master, supervisor_user])
        students: list[User] = []
        for index in range(student_count):
            student_user = User(
                email=f'student.schedule.{index}@example.com',
                password_hash=hash_password(PASSWORD),
                role='STUDENT',
            )
            students.append(student_user)
            session.add(student_user)
        await session.flush()

        term = AcademicTerm(
            name='Semestre de teste',
            starts_on=date(2026, 8, 1),
            ends_on=date(2026, 12, 20),
            status='ACTIVE',
        )
        course = Course(name='Fisioterapia teste', code='FIS-TEST')
        session.add_all([term, course])
        await session.flush()
        discipline = Discipline(
            course_id=course.id,
            name='Estagio de teste',
            code='EST-TEST',
            kind='INTERNSHIP',
        )
        cohort = Cohort(
            term_id=term.id,
            course_id=course.id,
            period=1,
            label='Turma teste',
        )
        clinic = Clinic(name='Clinica teste', address_label='Unidade ficticia')
        session.add_all([discipline, cohort, clinic])
        await session.flush()
        environment = Environment(clinic_id=clinic.id, name='Ambiente teste')
        equipment_type = EquipmentType(name='Equipamento teste')
        session.add_all([environment, equipment_type])
        await session.flush()
        environment_equipment = EnvironmentEquipment(
            environment_id=environment.id,
            equipment_type_id=equipment_type.id,
            quantity=equipment_quantity,
        )
        rooms = [
            Room(environment_id=environment.id, name=f'Sala teste {index}')
            for index in range(room_count)
        ]
        config = ClinicTermConfig(
            clinic_id=clinic.id,
            term_id=term.id,
            max_simultaneous_appointments=4,
            max_students=4,
        )
        service = ClinicalService(
            discipline_id=discipline.id,
            name='Atendimento teste',
            duration_minutes=60,
        )
        session.add_all([environment_equipment, *rooms, config, service])
        await session.flush()
        service_equipment = ServiceEquipmentRequirement(
            service_id=service.id,
            equipment_type_id=equipment_type.id,
            units_per_appointment=1,
        )
        supervisor = Supervisor(
            user_id=supervisor_user.id,
            kind='PROFESSOR',
            full_name='Supervisor Ficticio',
            professional_area='Fisioterapia',
            max_students_default=supervisor_limit,
        )
        scope = SupervisorServiceScope(
            supervisor_id=supervisor_user.id,
            term_id=term.id,
            service_id=service.id,
            environment_id=environment.id,
            can_review_documents=False,
        )
        session.add_all(
            [
                service_equipment,
                supervisor,
                scope,
            ]
        )
        await session.flush()
        for student_user in students:
            student = Student(
                user_id=student_user.id,
                registration=f'REG-{student_user.id.hex[:8]}',
                full_name='Estudante Ficticio',
            )
            link = StudentAcademicLink(
                student_id=student_user.id,
                term_id=term.id,
                cohort_id=cohort.id,
                discipline_id=discipline.id,
            )
            availability = StudentAvailability(
                student_id=student_user.id,
                term_id=term.id,
                weekday=2,
                start_time=time(8, 0),
                end_time=time(11, 0),
            )
            session.add_all([student, link, availability])
        session.add(
            SupervisorAvailability(
                supervisor_id=supervisor_user.id,
                term_id=term.id,
                weekday=2,
                start_time=time(8, 0),
                end_time=time(11, 0),
            )
        )
        if class_block:
            session.add(
                ClassBlock(
                    cohort_id=cohort.id,
                    discipline_id=discipline.id,
                    weekday=2,
                    start_time=time(9, 0),
                    end_time=time(10, 0),
                )
            )
        if document_required:
            session.add(
                DocumentRequirement(
                    term_id=term.id,
                    discipline_id=discipline.id,
                    name='Comprovante obrigatorio de teste',
                )
            )
        await session.commit()
        ids.update(
            term_id=term.id,
            clinic_id=clinic.id,
            service_id=service.id,
            environment_id=environment.id,
            supervisor_id=supervisor_user.id,
            student_ids=[student.id for student in students],
            master_email=master.email,
            supervisor_email=supervisor_user.email,
        )
    ids['master_token'] = await login(client, ids['master_email'])
    ids['supervisor_token'] = await login(client, ids['supervisor_email'])
    return ids


async def create_session(
    client: AsyncClient,
    token: str,
    context: dict[str, Any],
    *,
    starts_at: datetime = STARTS_AT,
    ends_at: datetime = ENDS_AT,
) -> dict[str, Any]:
    response = await client.post(
        '/api/v1/sessions',
        headers=auth(token),
        json={
            'term_id': str(context['term_id']),
            'clinic_id': str(context['clinic_id']),
            'service_id': str(context['service_id']),
            'environment_id': str(context['environment_id']),
            'supervisor_id': str(context['supervisor_id']),
            'starts_at': starts_at.isoformat(),
            'ends_at': ends_at.isoformat(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_pending_documents_block_allocation_without_persisting_it(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(scheduling_client, document_required=True)
    session = await create_session(
        scheduling_client, context['supervisor_token'], context
    )
    session_id = session['id']
    student_token = await login(
        scheduling_client,
        'student.schedule.0@example.com',
    )

    response = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )

    assert response.status_code == 409
    assert response.json()['error']['code'] == 'DOCUMENTS_PENDING'

    app = scheduling_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        count = await db_session.scalar(
            select(text('count(*)')).select_from(text('session_allocations'))
        )
    assert count == 0


@pytest.mark.asyncio
async def test_academic_conflict_blocks_allocation(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(scheduling_client, class_block=True)
    session = await create_session(
        scheduling_client, context['supervisor_token'], context
    )
    session_id = session['id']
    student_token = await login(
        scheduling_client,
        'student.schedule.0@example.com',
    )

    response = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )

    assert response.status_code == 409
    assert response.json()['error']['code'] == 'ACADEMIC_CONFLICT'


@pytest.mark.asyncio
async def test_supervision_limit_blocks_the_next_student(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(
        scheduling_client,
        student_count=2,
        supervisor_limit=1,
    )
    session = await create_session(
        scheduling_client, context['supervisor_token'], context
    )
    session_id = session['id']

    first = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(
            await login(scheduling_client, 'student.schedule.0@example.com')
        ),
        json={},
    )
    assert first.status_code == 201, first.text

    second = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(
            await login(scheduling_client, 'student.schedule.1@example.com')
        ),
        json={},
    )
    assert second.status_code == 409
    assert second.json()['error']['code'] == 'SUPERVISION_CAPACITY_REACHED'


@pytest.mark.asyncio
async def test_publish_explains_room_bottleneck_and_generates_full_slots_only(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(
        scheduling_client,
        student_count=3,
        supervisor_limit=4,
        room_count=2,
        equipment_quantity=3,
    )
    session = await create_session(
        scheduling_client,
        context['supervisor_token'],
        context,
        starts_at=datetime(2026, 10, 6, 11, 0, tzinfo=UTC),
        ends_at=datetime(2026, 10, 6, 13, 20, tzinfo=UTC),
    )
    session_id = session['id']
    for index in range(3):
        response = await scheduling_client.post(
            f'/api/v1/sessions/{session_id}/allocations',
            headers=auth(
                await login(
                    scheduling_client,
                    f'student.schedule.{index}@example.com',
                )
            ),
            json={},
        )
        assert response.status_code == 201, response.text

    capacity = await scheduling_client.get(
        f'/api/v1/sessions/{session_id}/capacity',
        headers=auth(context['supervisor_token']),
    )
    assert capacity.status_code == 200
    assert capacity.json()['effective'] == 2
    assert capacity.json()['limiting_factors'] == ['rooms']

    published = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 200, published.text
    assert published.json()['status'] == 'PUBLISHED'
    assert published.json()['slots_created'] == 2

    repeated = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert repeated.status_code == 200
    assert repeated.json()['slots_created'] == 2


@pytest.mark.asyncio
async def test_unviable_session_is_not_published_and_reports_zero_factor(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(
        scheduling_client,
        student_count=1,
        room_count=0,
    )
    session = await create_session(
        scheduling_client, context['supervisor_token'], context
    )
    session_id = session['id']
    student_token = await login(
        scheduling_client,
        'student.schedule.0@example.com',
    )
    allocated = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )
    assert allocated.status_code == 201, allocated.text

    published = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 409
    assert published.json()['error']['code'] == 'SESSION_NOT_PUBLISHABLE'
    assert published.json()['error']['details']['constraints']['rooms'] == 0


@pytest.mark.asyncio
async def test_document_rejection_suspends_future_allocation(
    scheduling_client: AsyncClient,
) -> None:
    context = await build_context(scheduling_client, document_required=True)
    app = scheduling_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as db_session:
        requirement = await db_session.scalar(select(DocumentRequirement))
        assert requirement is not None
        submission = DocumentSubmission(
            requirement_id=requirement.id,
            student_id=context['student_ids'][0],
            storage_key=f'{uuid4()}.pdf',
            original_name='comprovante-ficticio.pdf',
            mime_type='application/pdf',
            size_bytes=4,
            status=DocumentSubmissionStatus.APPROVED.value,
        )
        db_session.add(submission)
        await db_session.commit()
        submission_id = submission.id

    session = await create_session(
        scheduling_client, context['supervisor_token'], context
    )
    session_id = session['id']
    student_token = await login(
        scheduling_client,
        'student.schedule.0@example.com',
    )
    allocation = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/allocations',
        headers=auth(student_token),
        json={},
    )
    assert allocation.status_code == 201, allocation.text
    published = await scheduling_client.post(
        f'/api/v1/sessions/{session_id}/publish',
        headers=auth(context['supervisor_token']),
    )
    assert published.status_code == 200, published.text
    async with session_factory() as db_session:
        slot = await db_session.scalar(
            select(AppointmentSlot).where(
                AppointmentSlot.session_id == UUID(session_id)
            )
        )
        assert slot is not None
        slot_id = slot.id
    booking = await scheduling_client.post(
        '/api/v1/public/appointments',
        headers={'Idempotency-Key': 'risk-after-rejection-1'},
        json={
            'slot_id': str(slot_id),
            'name': 'Pessoa Demo',
            'email': 'pessoa.demo@example.com',
            'privacy_notice_version': '2026-01',
        },
    )
    assert booking.status_code == 201, booking.text
    appointment_id = UUID(booking.json()['id'])

    async with session_factory() as db_session:
        saved_submission = await db_session.get(
            DocumentSubmission, submission_id
        )
        assert saved_submission is not None
        saved_submission.status = DocumentSubmissionStatus.PENDING_REVIEW.value
        await db_session.commit()

    rejected = await scheduling_client.post(
        f'/api/v1/document-submissions/{submission_id}/reject',
        headers=auth(context['master_token']),
        json={'review_note': 'Enviar comprovante atualizado.'},
    )
    assert rejected.status_code == 200, rejected.text

    async with session_factory() as db_session:
        saved = await db_session.scalar(
            select(SessionAllocation).where(
                SessionAllocation.id == UUID(allocation.json()['id'])
            )
        )
        assert saved is not None
        assert saved.status == SessionAllocationStatus.SUSPENDED.value
        slot = await db_session.scalar(
            select(AppointmentSlot).where(
                AppointmentSlot.session_id == UUID(session_id)
            )
        )
        assert slot is not None
        assert slot.capacity_total == slot.reserved_count == 1
        appointment = await db_session.get(Appointment, appointment_id)
        assert appointment is not None
        assert appointment.risk_status == 'AT_RISK'
