from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    AuditEvent,
    Discipline,
    DocumentRequirement,
    DocumentSubmission,
    DocumentSubmissionStatus,
    Role,
    Student,
    StudentAcademicLink,
    User,
)
from app.modules.auth.dependencies import get_db_session, require_roles
from app.modules.documents.schemas import (
    DocumentApproveRequest,
    DocumentChecklistRead,
    DocumentRejectRequest,
    DocumentRequirementCreate,
    DocumentRequirementRead,
    DocumentRequirementUpdate,
    DocumentReviewRead,
    DocumentSubmissionRead,
)
from app.modules.documents.services import StudentEligibility, supervisor_can_review
from app.modules.documents.storage import DocumentStorage

router = APIRouter(tags=['documents'])
MasterUser = Annotated[User, Depends(require_roles(Role.MASTER))]
StudentUser = Annotated[User, Depends(require_roles(Role.STUDENT))]
ReviewerUser = Annotated[
    User, Depends(require_roles(Role.MASTER, Role.SUPERVISOR))
]

MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
ALLOWED_FILES = {
    'application/pdf': ('.pdf', b'%PDF-'),
    'image/jpeg': ('.jpg', b'\xff\xd8\xff'),
    'image/png': ('.png', b'\x89PNG\r\n\x1a\n'),
}


def not_found(resource: str = 'Recurso') -> ApiError:
    return ApiError(404, 'NOT_FOUND', f'{resource} nao encontrado.')


def invalid_state(message: str) -> ApiError:
    return ApiError(409, 'INVALID_STATE_TRANSITION', message)


async def commit_or_duplicate(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(
            409,
            'DUPLICATE_RESOURCE',
            'Ja existe um registro com os mesmos dados.',
        ) from None


async def load_requirement(
    session: AsyncSession, requirement_id: UUID, *, active: bool = True
) -> DocumentRequirement:
    requirement = await session.get(DocumentRequirement, requirement_id)
    if requirement is None or (active and not requirement.is_active):
        raise not_found('Requisito documental')
    return requirement


async def ensure_term_open(session: AsyncSession, term_id: UUID) -> AcademicTerm:
    term = await session.get(AcademicTerm, term_id)
    if term is None:
        raise not_found('Semestre')
    if term.status == 'CLOSED':
        raise invalid_state('Semestre fechado e somente leitura.')
    return term


async def ensure_requirement_applicable(
    session: AsyncSession,
    student_id: UUID,
    requirement: DocumentRequirement,
) -> None:
    query = select(StudentAcademicLink.id).where(
        StudentAcademicLink.student_id == student_id,
        StudentAcademicLink.term_id == requirement.term_id,
    )
    if requirement.discipline_id is not None:
        query = query.where(
            StudentAcademicLink.discipline_id == requirement.discipline_id
        )
    if await session.scalar(query.limit(1)) is None:
        raise not_found('Requisito documental')


async def read_upload(file: UploadFile) -> tuple[bytes, str, str]:
    filename = Path(file.filename or '').name
    suffix = Path(filename).suffix.lower()
    declared_mime = file.content_type or ''
    file_rule = ALLOWED_FILES.get(declared_mime)
    content = await file.read(MAX_DOCUMENT_SIZE + 1)
    if len(content) > MAX_DOCUMENT_SIZE:
        raise ApiError(
            422,
            'DOCUMENT_TOO_LARGE',
            'O documento deve ter no maximo 10 MiB.',
        )
    if (
        file_rule is None
        or suffix != file_rule[0]
        or not content.startswith(file_rule[1])
    ):
        raise ApiError(
            422,
            'INVALID_DOCUMENT_FILE',
            'O arquivo deve ter extensao, MIME e assinatura validos.',
        )
    safe_name = filename[:255] or 'documento'
    return content, safe_name, declared_mime


def storage_for(root: Path) -> DocumentStorage:
    return DocumentStorage(root / 'documents')


async def load_authorized_submission(
    session: AsyncSession,
    submission_id: UUID,
    current_user: User,
) -> tuple[DocumentSubmission, DocumentRequirement]:
    submission = await session.get(DocumentSubmission, submission_id)
    if submission is None:
        raise not_found('Submissao documental')
    requirement = await session.get(DocumentRequirement, submission.requirement_id)
    if requirement is None:
        raise not_found('Submissao documental')
    if current_user.role == Role.MASTER.value:
        return submission, requirement
    if current_user.role == Role.STUDENT.value:
        if submission.student_id == current_user.id:
            return submission, requirement
    elif await supervisor_can_review(session, current_user.id, requirement):
        return submission, requirement
    raise not_found('Submissao documental')


@router.get('/document-requirements', response_model=list[DocumentRequirementRead])
async def list_document_requirements(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    term_id: Annotated[UUID | None, Query()] = None,
) -> list[DocumentRequirement]:
    query = select(DocumentRequirement).order_by(
        DocumentRequirement.name, DocumentRequirement.id
    )
    if term_id is not None:
        query = query.where(DocumentRequirement.term_id == term_id)
    return list(await session.scalars(query))


@router.post(
    '/document-requirements',
    response_model=DocumentRequirementRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_document_requirement(
    payload: DocumentRequirementCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> DocumentRequirement:
    await ensure_term_open(session, payload.term_id)
    if payload.discipline_id is not None:
        discipline = await session.get(Discipline, payload.discipline_id)
        if discipline is None or not discipline.is_active:
            raise not_found('Disciplina')
        if discipline.course_id is None:
            raise not_found('Disciplina')
    requirement = DocumentRequirement(
        term_id=payload.term_id,
        discipline_id=payload.discipline_id,
        name=payload.name.strip(),
        expires_required=payload.expires_required,
    )
    session.add(requirement)
    await commit_or_duplicate(session)
    await session.refresh(requirement)
    return requirement


@router.patch(
    '/document-requirements/{requirement_id}',
    response_model=DocumentRequirementRead,
)
async def update_document_requirement(
    requirement_id: UUID,
    payload: DocumentRequirementUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> DocumentRequirement:
    requirement = await load_requirement(session, requirement_id)
    await ensure_term_open(session, requirement.term_id)
    requirement.name = payload.name.strip()
    requirement.expires_required = payload.expires_required
    await commit_or_duplicate(session)
    await session.refresh(requirement)
    return requirement


@router.post('/document-requirements/{requirement_id}/deactivate')
async def deactivate_document_requirement(
    requirement_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Response:
    requirement = await load_requirement(session, requirement_id)
    await ensure_term_open(session, requirement.term_id)
    requirement.is_active = False
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/me/document-requirements', response_model=DocumentChecklistRead)
async def get_my_document_requirements(
    term_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: StudentUser,
) -> DocumentChecklistRead:
    await ensure_term_open(session, term_id)
    result = await StudentEligibility().evaluate(session, current_user.id, term_id)
    await session.commit()
    return DocumentChecklistRead(
        term_id=term_id,
        eligible=result.eligible,
        pending_requirement_ids=result.pending_requirement_ids,
        items=result.items,
    )


@router.post(
    '/me/document-submissions',
    response_model=DocumentSubmissionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_document_submission(
    requirement_id: Annotated[UUID, Form()],
    file: Annotated[UploadFile, File()],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: StudentUser,
    request: Request,
) -> DocumentSubmission:
    requirement = await load_requirement(session, requirement_id)
    await ensure_requirement_applicable(session, current_user.id, requirement)
    latest = await session.scalar(
        select(DocumentSubmission)
        .where(
            DocumentSubmission.student_id == current_user.id,
            DocumentSubmission.requirement_id == requirement.id,
        )
        .order_by(DocumentSubmission.created_at.desc(), DocumentSubmission.id.desc())
        .limit(1)
    )
    if (
        latest is not None
        and latest.status == DocumentSubmissionStatus.PENDING_REVIEW.value
    ):
        raise invalid_state('Ja existe uma submissao pendente para este requisito.')
    if latest is not None and latest.status == DocumentSubmissionStatus.APPROVED.value:
        if latest.expires_at is None or latest.expires_at > datetime.now(UTC):
            raise invalid_state('O requisito ja possui uma aprovacao valida.')

    content, original_name, mime_type = await read_upload(file)
    storage = storage_for(request.app.state.settings.storage_path)
    storage_key = storage.save(content)
    submission = DocumentSubmission(
        requirement_id=requirement.id,
        student_id=current_user.id,
        storage_key=storage_key,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=len(content),
        status=DocumentSubmissionStatus.PENDING_REVIEW.value,
    )
    session.add(submission)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        storage.delete(storage_key)
        raise
    await session.refresh(submission)
    return submission


@router.get('/document-reviews', response_model=list[DocumentReviewRead])
async def list_document_reviews(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: ReviewerUser,
    review_status: Annotated[str, Query(alias='status')] = (
        DocumentSubmissionStatus.PENDING_REVIEW.value
    ),
) -> list[DocumentReviewRead]:
    query = (
        select(DocumentSubmission, DocumentRequirement, Student)
        .join(
            DocumentRequirement,
            DocumentRequirement.id == DocumentSubmission.requirement_id,
        )
        .join(Student, Student.user_id == DocumentSubmission.student_id)
        .where(DocumentSubmission.status == review_status)
        .order_by(DocumentSubmission.created_at, DocumentSubmission.id)
    )
    rows = list(await session.execute(query))
    reviews: list[DocumentReviewRead] = []
    for submission, requirement, student in rows:
        if current_user.role != Role.MASTER.value and not await supervisor_can_review(
            session, current_user.id, requirement
        ):
            continue
        reviews.append(
            DocumentReviewRead(
                **DocumentSubmissionRead.model_validate(submission).model_dump(),
                student_name=student.full_name,
                requirement_name=requirement.name,
                discipline_id=requirement.discipline_id,
            )
        )
    return reviews


async def lock_review_submission(
    session: AsyncSession,
    submission_id: UUID,
    current_user: User,
) -> tuple[DocumentSubmission, DocumentRequirement]:
    submission = await session.scalar(
        select(DocumentSubmission)
        .where(DocumentSubmission.id == submission_id)
        .with_for_update()
    )
    if submission is None:
        raise not_found('Submissao documental')
    requirement = await session.get(DocumentRequirement, submission.requirement_id)
    if requirement is None:
        raise not_found('Submissao documental')
    if current_user.role != Role.MASTER.value and not await supervisor_can_review(
        session, current_user.id, requirement
    ):
        raise not_found('Submissao documental')
    if submission.status != DocumentSubmissionStatus.PENDING_REVIEW.value:
        raise invalid_state('A submissao ja foi revisada.')
    return submission, requirement


@router.get('/document-submissions/{submission_id}/content')
async def download_document_submission(
    submission_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[
        User, Depends(require_roles(Role.MASTER, Role.SUPERVISOR, Role.STUDENT))
    ],
    request: Request,
) -> Response:
    submission, _ = await load_authorized_submission(
        session, submission_id, current_user
    )
    storage = storage_for(request.app.state.settings.storage_path)
    try:
        content = storage.read(submission.storage_key)
    except FileNotFoundError:
        raise not_found('Submissao documental') from None
    return Response(
        content=content,
        media_type=submission.mime_type,
        headers={'Content-Disposition': 'attachment; filename=documento'},
    )


@router.post(
    '/document-submissions/{submission_id}/approve',
    response_model=DocumentSubmissionRead,
)
async def approve_document_submission(
    submission_id: UUID,
    payload: DocumentApproveRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: ReviewerUser,
) -> DocumentSubmission:
    submission, requirement = await lock_review_submission(
        session, submission_id, current_user
    )
    if requirement.expires_required and payload.expires_at is None:
        raise ApiError(
            422,
            'DOCUMENT_EXPIRY_REQUIRED',
            'Este requisito exige data de validade.',
        )
    if payload.expires_at is not None and payload.expires_at <= datetime.now(UTC):
        raise ApiError(
            422,
            'DOCUMENT_EXPIRY_INVALID',
            'A validade deve estar no futuro.',
        )
    submission.status = DocumentSubmissionStatus.APPROVED.value
    submission.expires_at = payload.expires_at
    submission.review_note = None
    submission.reviewed_by = current_user.id
    submission.reviewed_at = datetime.now(UTC)
    session.add(
        AuditEvent(
            actor_user_id=current_user.id,
            action='DOCUMENT_APPROVED',
            target_type='document_submission',
            target_id=submission.id,
            metadata_json={
                'status': DocumentSubmissionStatus.APPROVED.value,
                'requirement_id': str(requirement.id),
            },
        )
    )
    await session.commit()
    await session.refresh(submission)
    return submission


@router.post(
    '/document-submissions/{submission_id}/reject',
    response_model=DocumentSubmissionRead,
)
async def reject_document_submission(
    submission_id: UUID,
    payload: DocumentRejectRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: ReviewerUser,
) -> DocumentSubmission:
    submission, requirement = await lock_review_submission(
        session, submission_id, current_user
    )
    review_note = payload.review_note.strip()
    if not review_note:
        raise ApiError(
            422,
            'REVIEW_NOTE_REQUIRED',
            'A recusa precisa informar como corrigir o documento.',
        )
    submission.status = DocumentSubmissionStatus.REJECTED.value
    submission.expires_at = None
    submission.review_note = review_note
    submission.reviewed_by = current_user.id
    submission.reviewed_at = datetime.now(UTC)
    session.add(
        AuditEvent(
            actor_user_id=current_user.id,
            action='DOCUMENT_REJECTED',
            target_type='document_submission',
            target_id=submission.id,
            metadata_json={
                'status': DocumentSubmissionStatus.REJECTED.value,
                'requirement_id': str(requirement.id),
            },
        )
    )
    await session.commit()
    await session.refresh(submission)
    return submission
