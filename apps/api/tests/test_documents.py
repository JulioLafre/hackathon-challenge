from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text, update

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import (
    AcademicTerm,
    AuditEvent,
    Clinic,
    ClinicalService,
    Cohort,
    Course,
    Discipline,
    DisciplineKind,
    DocumentSubmission,
    Environment,
    Role,
    Student,
    StudentAcademicLink,
    Supervisor,
    SupervisorKind,
    SupervisorServiceScope,
    User,
)
from app.db.session import create_session_factory
from app.main import create_app

PASSWORD = 'DemoPassword!2026'


@pytest_asyncio.fixture
async def document_client(tmp_path: Path) -> AsyncClient:
    settings = get_settings().model_copy(update={'storage_path': tmp_path})
    app = create_app(settings)
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        await session.execute(
            text(
                'TRUNCATE document_submissions, document_requirements, '
                'audit_events, supervisor_service_scopes, services, environments, '
                'clinics, student_academic_links, cohorts, disciplines, courses, '
                'academic_terms, supervisors, students, users, app_metadata '
                'RESTART IDENTITY CASCADE'
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
        password_hash=hash_password(PASSWORD),
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
        json={'email': email, 'password': PASSWORD},
    )
    assert response.status_code == 200
    return response.json()['access_token']


def auth(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


async def create_context(client: AsyncClient) -> dict[str, Any]:
    master = await create_user(
        client, email='master.documents@example.com', role=Role.MASTER
    )
    student = await create_user(
        client, email='student.documents@example.com', role=Role.STUDENT
    )
    supervisor = await create_user(
        client, email='supervisor.documents@example.com', role=Role.SUPERVISOR
    )
    app = client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        term = AcademicTerm(
            name='2026.2 documentos',
            starts_on=date(2026, 8, 1),
            ends_on=date(2026, 12, 20),
            status='ACTIVE',
        )
        course = Course(name='Fisioterapia documentos', code='FIS-DOC')
        session.add_all([term, course])
        await session.flush()
        discipline = Discipline(
            course_id=course.id,
            name='Pratica documental',
            code='FIS-DOC-01',
            kind=DisciplineKind.DISCIPLINE.value,
        )
        cohort = Cohort(
            term_id=term.id,
            course_id=course.id,
            period=5,
            label='Turma documental',
        )
        student_profile = Student(
            user_id=student.id,
            registration='DOC-001',
            full_name='Estudante Ficticio',
        )
        supervisor_profile = Supervisor(
            user_id=supervisor.id,
            kind=SupervisorKind.PROFESSOR.value,
            full_name='Supervisor Ficticio',
            professional_area='Fisioterapia',
            max_students_default=4,
        )
        clinic = Clinic(name='Clinica Documental', address_label='Endereco ficticio')
        session.add_all(
            [discipline, cohort, student_profile, supervisor_profile, clinic]
        )
        await session.flush()
        environment = Environment(clinic_id=clinic.id, name='Ambiente Documental')
        session.add(environment)
        await session.flush()
        service = ClinicalService(
            discipline_id=discipline.id,
            name='Servico Documental',
            duration_minutes=60,
        )
        session.add(service)
        await session.flush()
        session.add_all(
            [
                StudentAcademicLink(
                    student_id=student.id,
                    term_id=term.id,
                    cohort_id=cohort.id,
                    discipline_id=discipline.id,
                ),
                SupervisorServiceScope(
                    supervisor_id=supervisor.id,
                    term_id=term.id,
                    service_id=service.id,
                    environment_id=environment.id,
                    can_review_documents=True,
                ),
            ]
        )
        await session.commit()
    return {
        'master': master,
        'student': student,
        'supervisor': supervisor,
        'term': term,
        'discipline': discipline,
    }


async def create_requirement(
    client: AsyncClient,
    token: str,
    context: dict[str, Any],
    *,
    name: str = 'Comprovante ficticio',
    discipline_id: str | None = None,
    expires_required: bool = False,
) -> dict[str, Any]:
    response = await client.post(
        '/api/v1/document-requirements',
        headers=auth(token),
        json={
            'term_id': str(context['term'].id),
            'discipline_id': discipline_id,
            'name': name,
            'expires_required': expires_required,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def upload(
    client: AsyncClient,
    token: str,
    requirement_id: str,
    *,
    filename: str = 'comprovante.pdf',
    content_type: str = 'application/pdf',
    content: bytes = b'%PDF-1.7\nficitious document',
) -> Any:
    return await client.post(
        '/api/v1/me/document-submissions',
        headers=auth(token),
        data={'requirement_id': requirement_id},
        files={'file': (filename, content, content_type)},
    )


@pytest.mark.asyncio
async def test_checklist_states_rejection_reupload_and_audit(
    document_client: AsyncClient,
) -> None:
    context = await create_context(document_client)
    master_token = await login(document_client, context['master'].email)
    student_token = await login(document_client, context['student'].email)
    master_me = await document_client.get('/api/v1/me', headers=auth(master_token))
    assert master_me.status_code == 200, master_me.text
    requirement = await create_requirement(document_client, master_token, context)
    term_id = context['term'].id

    initial = await document_client.get(
        f'/api/v1/me/document-requirements?term_id={term_id}',
        headers=auth(student_token),
    )
    assert initial.status_code == 200
    assert initial.json()['eligible'] is False
    assert initial.json()['items'][0]['status'] == 'MISSING'
    assert initial.json()['pending_requirement_ids'] == [requirement['id']]

    first = await upload(document_client, student_token, requirement['id'])
    assert first.status_code == 201
    first_id = first.json()['id']
    assert first.json()['status'] == 'PENDING_REVIEW'

    missing_note = await document_client.post(
        f'/api/v1/document-submissions/{first_id}/reject',
        headers=auth(master_token),
        json={'review_note': '   '},
    )
    assert missing_note.status_code == 422
    assert missing_note.json()['error']['code'] == 'REVIEW_NOTE_REQUIRED'

    rejected = await document_client.post(
        f'/api/v1/document-submissions/{first_id}/reject',
        headers=auth(master_token),
        json={'review_note': 'Envie uma imagem legivel.'},
    )
    assert rejected.status_code == 200
    assert rejected.json()['status'] == 'REJECTED'

    after_rejection = await document_client.get(
        f'/api/v1/me/document-requirements?term_id={term_id}',
        headers=auth(student_token),
    )
    item = after_rejection.json()['items'][0]
    assert item['status'] == 'REJECTED'
    assert item['review_note'] == 'Envie uma imagem legivel.'

    second = await upload(
        document_client,
        student_token,
        requirement['id'],
        filename='comprovante.png',
        content_type='image/png',
        content=b'\x89PNG\r\n\x1a\nficitious image',
    )
    assert second.status_code == 201
    assert second.json()['id'] != first_id
    second_id = second.json()['id']

    approved = await document_client.post(
        f'/api/v1/document-submissions/{second_id}/approve',
        headers=auth(master_token),
        json={'expires_at': (datetime.now(UTC) + timedelta(days=30)).isoformat()},
    )
    assert approved.status_code == 200
    assert approved.json()['status'] == 'APPROVED'

    final = await document_client.get(
        f'/api/v1/me/document-requirements?term_id={term_id}',
        headers=auth(student_token),
    )
    assert final.json()['eligible'] is True
    assert final.json()['pending_requirement_ids'] == []

    app = document_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        audits = list(await session.scalars(select(AuditEvent)))
        assert {audit.action for audit in audits} == {
            'DOCUMENT_REJECTED',
            'DOCUMENT_APPROVED',
        }
        assert all('review_note' not in (audit.metadata_json or {}) for audit in audits)


@pytest.mark.asyncio
async def test_upload_rejects_disguised_and_oversized_files_before_metadata(
    document_client: AsyncClient,
) -> None:
    context = await create_context(document_client)
    master_token = await login(document_client, context['master'].email)
    student_token = await login(document_client, context['student'].email)
    requirement = await create_requirement(document_client, master_token, context)

    disguised = await upload(
        document_client,
        student_token,
        requirement['id'],
        filename='documento.pdf',
        content_type='application/pdf',
        content=b'not a pdf',
    )
    assert disguised.status_code == 422
    assert disguised.json()['error']['code'] == 'INVALID_DOCUMENT_FILE'

    oversized = await upload(
        document_client,
        student_token,
        requirement['id'],
        content=b'%PDF-1.7\n' + b'x' * (10 * 1024 * 1024 + 1),
    )
    assert oversized.status_code == 422
    assert oversized.json()['error']['code'] == 'DOCUMENT_TOO_LARGE'

    app = document_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        count = await session.scalar(text('SELECT count(*) FROM document_submissions'))
        assert count == 0
    assert not [p for p in app.state.settings.storage_path.rglob('*') if p.is_file()]


@pytest.mark.asyncio
async def test_download_and_review_are_object_authorized(
    document_client: AsyncClient,
) -> None:
    context = await create_context(document_client)
    master_token = await login(document_client, context['master'].email)
    student_token = await login(document_client, context['student'].email)
    supervisor_token = await login(document_client, context['supervisor'].email)
    student_b = await create_user(
        document_client, email='student-b.documents@example.com', role=Role.STUDENT
    )
    student_b_token = await login(document_client, student_b.email)
    outsider = await create_user(
        document_client, email='outsider.documents@example.com', role=Role.SUPERVISOR
    )
    outsider_token = await login(document_client, outsider.email)
    requirement = await create_requirement(document_client, master_token, context)
    submission = await upload(document_client, student_token, requirement['id'])
    submission_id = submission.json()['id']

    student_denied = await document_client.get(
        f'/api/v1/document-submissions/{submission_id}/content',
        headers=auth(student_b_token),
    )
    assert student_denied.status_code == 404
    assert 'comprovante.pdf' not in student_denied.text

    supervisor_denied = await document_client.get(
        f'/api/v1/document-submissions/{submission_id}/content',
        headers=auth(outsider_token),
    )
    assert supervisor_denied.status_code == 404
    assert 'comprovante.pdf' not in supervisor_denied.text

    outsider_queue = await document_client.get(
        '/api/v1/document-reviews?status=PENDING_REVIEW',
        headers=auth(outsider_token),
    )
    assert outsider_queue.status_code == 200
    assert outsider_queue.json() == []

    reviewer_queue = await document_client.get(
        '/api/v1/document-reviews?status=PENDING_REVIEW',
        headers=auth(supervisor_token),
    )
    assert reviewer_queue.status_code == 200
    assert [item['id'] for item in reviewer_queue.json()] == [submission_id]

    reviewer_content = await document_client.get(
        f'/api/v1/document-submissions/{submission_id}/content',
        headers=auth(supervisor_token),
    )
    assert reviewer_content.status_code == 200
    assert reviewer_content.content.startswith(b'%PDF-')


@pytest.mark.asyncio
async def test_expired_approval_is_not_eligible_and_is_reported(
    document_client: AsyncClient,
) -> None:
    context = await create_context(document_client)
    master_token = await login(document_client, context['master'].email)
    student_token = await login(document_client, context['student'].email)
    requirement = await create_requirement(document_client, master_token, context)
    term_id = context['term'].id
    submission = await upload(document_client, student_token, requirement['id'])
    submission_id = submission.json()['id']

    app = document_client._transport.app  # type: ignore[attr-defined]
    session_factory = create_session_factory(app.state.engine)
    async with session_factory() as session:
        await session.execute(
            update(DocumentSubmission)
            .where(DocumentSubmission.id == submission_id)
            .values(
                status='APPROVED',
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        await session.commit()

    checklist = await document_client.get(
        f'/api/v1/me/document-requirements?term_id={term_id}',
        headers=auth(student_token),
    )
    assert checklist.status_code == 200
    assert checklist.json()['eligible'] is False
    assert checklist.json()['items'][0]['status'] == 'EXPIRED'
