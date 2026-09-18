from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    AppointmentSlot,
    AuditEvent,
    Clinic,
    ClinicalService,
    ClinicalSession,
    ClinicalSessionStatus,
    ClinicTermConfig,
    Course,
    Discipline,
    Environment,
    Role,
    SessionAllocation,
    SessionAllocationStatus,
    Student,
    Supervisor,
    SupervisorServiceScope,
    User,
)
from app.modules.auth.dependencies import CurrentUser, get_db_session, require_roles
from app.modules.documents.services import StudentEligibility
from app.modules.scheduling.schemas import (
    CapacityRead,
    SessionAllocationCreate,
    SessionAllocationRead,
    SessionCancelRead,
    SessionCreate,
    SessionPublishRead,
    SessionRead,
    SessionUpdate,
    StudentSessionRead,
    SupervisorSessionOptionRead,
)
from app.modules.scheduling.services import (
    calculate_capacity,
    ensure_student_compatibility,
    ensure_supervisor_availability,
    materialize_slots,
)

router = APIRouter(tags=['scheduling'])
SessionOperator = Annotated[
    User, Depends(require_roles(Role.MASTER, Role.SUPERVISOR))
]
SupervisorUser = Annotated[User, Depends(require_roles(Role.SUPERVISOR))]
StudentUser = Annotated[User, Depends(require_roles(Role.STUDENT))]


def not_found(resource: str) -> ApiError:
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


async def load_session(
    session: AsyncSession,
    session_id: UUID,
    *,
    for_update: bool = False,
) -> ClinicalSession:
    if for_update:
        clinical_session = await session.scalar(
            select(ClinicalSession)
            .where(ClinicalSession.id == session_id)
            .with_for_update()
        )
    else:
        clinical_session = await session.get(ClinicalSession, session_id)
    if clinical_session is None:
        raise not_found('Sessao')
    return clinical_session


async def ensure_scope(
    session: AsyncSession,
    current_user: User,
    clinical_session: ClinicalSession,
) -> None:
    if current_user.role == Role.MASTER.value:
        return
    if clinical_session.supervisor_id != current_user.id:
        raise not_found('Sessao')
    scope = await session.scalar(
        select(SupervisorServiceScope.id).where(
            SupervisorServiceScope.supervisor_id == current_user.id,
            SupervisorServiceScope.term_id == clinical_session.term_id,
            SupervisorServiceScope.service_id == clinical_session.service_id,
            SupervisorServiceScope.environment_id == clinical_session.environment_id,
            SupervisorServiceScope.is_active.is_(True),
        )
    )
    if scope is None:
        raise not_found('Sessao')


async def ensure_context(
    session: AsyncSession,
    clinical_session: ClinicalSession,
) -> None:
    term = await session.get(AcademicTerm, clinical_session.term_id)
    clinic = await session.get(Clinic, clinical_session.clinic_id)
    environment = await session.get(Environment, clinical_session.environment_id)
    service = await session.get(ClinicalService, clinical_session.service_id)
    supervisor = await session.get(Supervisor, clinical_session.supervisor_id)
    if term is None or clinic is None or environment is None or service is None:
        raise not_found('Configuracao da sessao')
    if supervisor is None:
        raise not_found('Supervisor')
    if term.status == 'CLOSED':
        raise invalid_state('Semestre fechado e somente leitura.')
    if (
        not clinic.is_active
        or not environment.is_active
        or not service.is_active
    ):
        raise ApiError(
            422,
            'RESOURCE_INACTIVE',
            'A sessao referencia um recurso desativado.',
        )
    if environment.clinic_id != clinic.id:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'Ambiente e clinica nao sao compativeis.',
        )
    discipline = await session.get(Discipline, service.discipline_id)
    if discipline is None or not discipline.is_active:
        raise ApiError(
            422,
            'RESOURCE_INACTIVE',
            'A disciplina do servico esta desativada.',
        )
    course = await session.get(Course, discipline.course_id)
    if course is None or not course.is_active:
        raise ApiError(
            422,
            'RESOURCE_INACTIVE',
            'O curso da disciplina esta desativado.',
        )
    user = await session.get(User, clinical_session.supervisor_id)
    if user is None or not user.is_active or user.role != Role.SUPERVISOR.value:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O supervisor informado nao esta ativo.',
        )
    scope = await session.scalar(
        select(SupervisorServiceScope.id).where(
            SupervisorServiceScope.supervisor_id == clinical_session.supervisor_id,
            SupervisorServiceScope.term_id == clinical_session.term_id,
            SupervisorServiceScope.service_id == clinical_session.service_id,
            SupervisorServiceScope.environment_id == clinical_session.environment_id,
            SupervisorServiceScope.is_active.is_(True),
        )
    )
    if scope is None:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O supervisor nao possui escopo para esta sessao.',
        )
    if (
        await session.scalar(
            select(ClinicTermConfig.id).where(
                ClinicTermConfig.clinic_id == clinical_session.clinic_id,
                ClinicTermConfig.term_id == clinical_session.term_id,
            )
        )
        is None
    ):
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'A clinica nao possui limites configurados para o semestre.',
        )


def session_read(clinical_session: ClinicalSession) -> SessionRead:
    return SessionRead.model_validate(clinical_session)


@router.get('/sessions', response_model=list[SessionRead])
async def list_sessions(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> list[ClinicalSession]:
    query = select(ClinicalSession).order_by(
        ClinicalSession.starts_at, ClinicalSession.id
    )
    if current_user.role == Role.SUPERVISOR.value:
        query = query.where(ClinicalSession.supervisor_id == current_user.id)
    return list(await session.scalars(query))


@router.get(
    '/me/session-options',
    response_model=list[SupervisorSessionOptionRead],
)
async def list_my_session_options(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SupervisorUser,
) -> list[SupervisorSessionOptionRead]:
    rows = (
        await session.execute(
            select(
                SupervisorServiceScope,
                AcademicTerm,
                ClinicalService,
                Clinic,
                Environment,
                Supervisor,
            )
            .join(AcademicTerm, AcademicTerm.id == SupervisorServiceScope.term_id)
            .join(
                ClinicalService,
                ClinicalService.id == SupervisorServiceScope.service_id,
            )
            .join(Environment, Environment.id == SupervisorServiceScope.environment_id)
            .join(Clinic, Clinic.id == Environment.clinic_id)
            .join(
                Supervisor,
                Supervisor.user_id == SupervisorServiceScope.supervisor_id,
            )
            .join(User, User.id == SupervisorServiceScope.supervisor_id)
            .where(
                SupervisorServiceScope.supervisor_id == current_user.id,
                SupervisorServiceScope.is_active.is_(True),
                AcademicTerm.status.in_(['DRAFT', 'ACTIVE']),
                ClinicalService.is_active.is_(True),
                Environment.is_active.is_(True),
                Clinic.is_active.is_(True),
                User.is_active.is_(True),
            )
            .order_by(
                AcademicTerm.starts_on.desc(),
                ClinicalService.name,
                Clinic.name,
                Environment.name,
            )
        )
    ).all()
    return [
        SupervisorSessionOptionRead(
            id=scope.id,
            supervisor_id=scope.supervisor_id,
            term_id=term.id,
            term_name=term.name,
            term_status=term.status,
            term_starts_on=term.starts_on,
            term_ends_on=term.ends_on,
            service_id=service.id,
            service_name=service.name,
            duration_minutes=service.duration_minutes,
            clinic_id=clinic.id,
            clinic_name=clinic.name,
            environment_id=environment.id,
            environment_name=environment.name,
            max_students_default=supervisor.max_students_default,
            max_students_override=scope.max_students_override,
        )
        for scope, term, service, clinic, environment, supervisor in rows
    ]


@router.get(
    '/me/available-sessions',
    response_model=list[StudentSessionRead],
)
async def list_my_available_sessions(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: StudentUser,
) -> list[StudentSessionRead]:
    now = datetime.now(UTC)
    rows = (
        await session.execute(
            select(
                ClinicalSession,
                AcademicTerm,
                ClinicalService,
                Clinic,
                Environment,
                Supervisor,
                SessionAllocation,
            )
            .join(AcademicTerm, AcademicTerm.id == ClinicalSession.term_id)
            .join(ClinicalService, ClinicalService.id == ClinicalSession.service_id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .join(Environment, Environment.id == ClinicalSession.environment_id)
            .join(Supervisor, Supervisor.user_id == ClinicalSession.supervisor_id)
            .outerjoin(
                SessionAllocation,
                and_(
                    SessionAllocation.session_id == ClinicalSession.id,
                    SessionAllocation.student_id == current_user.id,
                    SessionAllocation.status.in_(
                        [
                            SessionAllocationStatus.ACTIVE.value,
                            SessionAllocationStatus.SUSPENDED.value,
                        ]
                    ),
                ),
            )
            .where(
                ClinicalSession.starts_at > now,
                ClinicalSession.status.in_(
                    [
                        ClinicalSessionStatus.DRAFT.value,
                        ClinicalSessionStatus.PUBLISHED.value,
                    ]
                ),
                AcademicTerm.status.in_(['DRAFT', 'ACTIVE']),
                ClinicalService.is_active.is_(True),
                Clinic.is_active.is_(True),
                Environment.is_active.is_(True),
            )
            .order_by(ClinicalSession.starts_at, ClinicalSession.id)
        )
    ).all()

    has_profile = await session.get(Student, current_user.id) is not None
    eligibility = StudentEligibility()
    result: list[StudentSessionRead] = []
    for (
        clinical_session,
        term,
        service,
        clinic,
        environment,
        supervisor,
        allocation,
    ) in rows:
        if (
            allocation is None
            and clinical_session.status != ClinicalSessionStatus.DRAFT.value
        ):
            continue

        can_join = False
        blocked_code: str | None = None
        blocked_message: str | None = None
        if allocation is None:
            if not has_profile:
                blocked_code = 'PROFILE_REQUIRED'
                blocked_message = (
                    'Seu perfil academico ainda precisa ser criado pelo Master.'
                )
            else:
                try:
                    await ensure_student_compatibility(
                        session, clinical_session, current_user.id
                    )
                    await eligibility.ensure_eligible(
                        session, current_user.id, clinical_session.term_id
                    )
                    can_join = True
                except ApiError as error:
                    blocked_code = error.code
                    blocked_message = error.message
        elif allocation.status == SessionAllocationStatus.SUSPENDED.value:
            blocked_code = allocation.suspended_reason or 'DOCUMENTS_PENDING'
            blocked_message = (
                'Sua participacao esta suspensa. Revise os documentos pendentes '
                'antes de continuar.'
            )
        else:
            blocked_message = 'Voce ja esta inscrito nesta sessao.'

        result.append(
            StudentSessionRead(
                id=clinical_session.id,
                term_id=term.id,
                term_name=term.name,
                service_id=service.id,
                service_name=service.name,
                clinic_id=clinic.id,
                clinic_name=clinic.name,
                environment_id=environment.id,
                environment_name=environment.name,
                supervisor_id=supervisor.user_id,
                supervisor_name=supervisor.full_name,
                starts_at=clinical_session.starts_at,
                ends_at=clinical_session.ends_at,
                status=clinical_session.status,
                allocation_id=allocation.id if allocation is not None else None,
                allocation_status=allocation.status if allocation is not None else None,
                can_join=can_join,
                blocked_code=blocked_code,
                blocked_message=blocked_message,
            )
        )
    return result


@router.post(
    '/sessions',
    response_model=SessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    payload: SessionCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> SessionRead:
    clinical_session = ClinicalSession(
        term_id=payload.term_id,
        service_id=payload.service_id,
        clinic_id=payload.clinic_id,
        environment_id=payload.environment_id,
        supervisor_id=payload.supervisor_id,
        starts_at=payload.starts_at.astimezone(UTC),
        ends_at=payload.ends_at.astimezone(UTC),
        max_students_override=payload.max_students_override,
    )
    if (
        current_user.role == Role.SUPERVISOR.value
        and clinical_session.supervisor_id != current_user.id
    ):
        raise not_found('Sessao')
    session.add(clinical_session)
    await session.flush()
    await ensure_context(session, clinical_session)
    await ensure_scope(session, current_user, clinical_session)
    await ensure_supervisor_availability(session, clinical_session)
    await commit_or_duplicate(session)
    await session.refresh(clinical_session)
    return session_read(clinical_session)


@router.get('/sessions/{session_id}', response_model=SessionRead)
async def get_session(
    session_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> SessionRead:
    clinical_session = await load_session(session, session_id)
    await ensure_scope(session, current_user, clinical_session)
    return session_read(clinical_session)


@router.patch('/sessions/{session_id}', response_model=SessionRead)
async def update_session(
    session_id: UUID,
    payload: SessionUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> SessionRead:
    clinical_session = await load_session(session, session_id, for_update=True)
    await ensure_scope(session, current_user, clinical_session)
    if clinical_session.status != ClinicalSessionStatus.DRAFT.value:
        raise invalid_state('Somente sessoes em rascunho podem ser editadas.')
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        if field in {'starts_at', 'ends_at'} and value is not None:
            value = value.astimezone(UTC)
        setattr(clinical_session, field, value)
    if clinical_session.ends_at <= clinical_session.starts_at:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O fim deve ser posterior ao inicio da sessao.',
        )
    await ensure_context(session, clinical_session)
    await ensure_scope(session, current_user, clinical_session)
    await ensure_supervisor_availability(session, clinical_session)
    await commit_or_duplicate(session)
    await session.refresh(clinical_session)
    return session_read(clinical_session)


@router.get('/sessions/{session_id}/capacity', response_model=CapacityRead)
async def get_capacity(
    session_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> CapacityRead:
    clinical_session = await load_session(session, session_id)
    await ensure_scope(session, current_user, clinical_session)
    explanation = await calculate_capacity(session, clinical_session)
    clinical_session.capacity_explanation = explanation.as_dict()
    await session.commit()
    return CapacityRead.model_validate(explanation.as_dict())


@router.post(
    '/sessions/{session_id}/publish',
    response_model=SessionPublishRead,
)
async def publish_session(
    session_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> SessionPublishRead:
    clinical_session = await load_session(session, session_id, for_update=True)
    await ensure_scope(session, current_user, clinical_session)
    if clinical_session.status == ClinicalSessionStatus.PUBLISHED.value:
        slots_created = await session.scalar(
            select(func.count()).where(
                AppointmentSlot.session_id == clinical_session.id
            )
        )
        return SessionPublishRead(
            **session_read(clinical_session).model_dump(),
            slots_created=int(slots_created or 0),
        )
    if clinical_session.status != ClinicalSessionStatus.DRAFT.value:
        raise invalid_state('Somente sessoes em rascunho podem ser publicadas.')
    await ensure_context(session, clinical_session)
    explanation = await calculate_capacity(session, clinical_session)
    if explanation.effective <= 0:
        raise ApiError(
            409,
            'SESSION_NOT_PUBLISHABLE',
            'A sessao nao possui capacidade efetiva positiva.',
            details=explanation.as_dict(),
        )
    slots_created = await materialize_slots(session, clinical_session, explanation)
    clinical_session.status = ClinicalSessionStatus.PUBLISHED.value
    clinical_session.published_at = datetime.now(UTC)
    clinical_session.capacity_explanation = explanation.as_dict()
    session.add(
        AuditEvent(
            actor_user_id=current_user.id,
            action='SESSION_PUBLISHED',
            target_type='clinical_session',
            target_id=clinical_session.id,
            metadata_json={'status': clinical_session.status},
        )
    )
    await commit_or_duplicate(session)
    await session.refresh(clinical_session)
    return SessionPublishRead(
        **session_read(clinical_session).model_dump(),
        slots_created=slots_created,
    )


@router.post(
    '/sessions/{session_id}/cancel',
    response_model=SessionCancelRead,
)
async def cancel_session(
    session_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: SessionOperator,
) -> SessionCancelRead:
    clinical_session = await load_session(session, session_id, for_update=True)
    await ensure_scope(session, current_user, clinical_session)
    if clinical_session.status in {
        ClinicalSessionStatus.CANCELLED.value,
        ClinicalSessionStatus.COMPLETED.value,
    }:
        raise invalid_state('A sessao ja esta encerrada.')
    clinical_session.status = ClinicalSessionStatus.CANCELLED.value
    clinical_session.cancelled_at = datetime.now(UTC)
    session.add(
        AuditEvent(
            actor_user_id=current_user.id,
            action='SESSION_CANCELLED',
            target_type='clinical_session',
            target_id=clinical_session.id,
            metadata_json={'status': clinical_session.status},
        )
    )
    await commit_or_duplicate(session)
    await session.refresh(clinical_session)
    return SessionCancelRead.model_validate(clinical_session)


@router.post(
    '/sessions/{session_id}/allocations',
    response_model=SessionAllocationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_allocation(
    session_id: UUID,
    payload: SessionAllocationCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: CurrentUser,
) -> SessionAllocationRead:
    clinical_session = await load_session(session, session_id, for_update=True)
    if clinical_session.status != ClinicalSessionStatus.DRAFT.value:
        raise invalid_state('Somente sessoes em rascunho aceitam alocacoes.')
    if current_user.role == Role.STUDENT.value:
        student_id = current_user.id
    elif current_user.role == Role.MASTER.value:
        if payload.student_id is None:
            raise ApiError(
                422,
                'VALIDATION_ERROR',
                'student_id e obrigatorio para o Master.',
            )
        student_id = payload.student_id
    else:
        raise ApiError(403, 'FORBIDDEN', 'Perfil sem permissao para alocar.')
    await ensure_student_compatibility(session, clinical_session, student_id)
    await StudentEligibility().ensure_eligible(
        session,
        student_id,
        clinical_session.term_id,
    )
    duplicate = await session.scalar(
        select(SessionAllocation.id).where(
            SessionAllocation.session_id == clinical_session.id,
            SessionAllocation.student_id == student_id,
            SessionAllocation.status.in_(
                [
                    SessionAllocationStatus.ACTIVE.value,
                    SessionAllocationStatus.SUSPENDED.value,
                ]
            ),
        )
    )
    if duplicate is not None:
        raise ApiError(
            409,
            'DUPLICATE_RESOURCE',
            'O estudante ja esta alocado nesta sessao.',
        )
    context = await session.get(ClinicalService, clinical_session.service_id)
    supervisor = await session.get(Supervisor, clinical_session.supervisor_id)
    scope = await session.scalar(
        select(SupervisorServiceScope).where(
            SupervisorServiceScope.supervisor_id == clinical_session.supervisor_id,
            SupervisorServiceScope.term_id == clinical_session.term_id,
            SupervisorServiceScope.service_id == clinical_session.service_id,
            SupervisorServiceScope.environment_id == clinical_session.environment_id,
            SupervisorServiceScope.is_active.is_(True),
        )
    )
    if context is None or supervisor is None or scope is None:
        raise not_found('Configuracao da sessao')
    current_count = await session.scalar(
        select(func.count()).where(
            SessionAllocation.session_id == clinical_session.id,
            SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
        )
    )
    supervisor_limit = supervisor.max_students_default
    if scope.max_students_override is not None:
        supervisor_limit = min(supervisor_limit, scope.max_students_override)
    if clinical_session.max_students_override is not None:
        supervisor_limit = min(
            supervisor_limit, clinical_session.max_students_override
        )
    if int(current_count or 0) >= supervisor_limit:
        raise ApiError(
            409,
            'SUPERVISION_CAPACITY_REACHED',
            'O limite de estudantes do supervisor foi atingido.',
        )
    config = await session.scalar(
        select(ClinicTermConfig).where(
            ClinicTermConfig.clinic_id == clinical_session.clinic_id,
            ClinicTermConfig.term_id == clinical_session.term_id,
        )
    )
    if config is None:
        raise not_found('Configuracao da clinica')
    other_clinic_count = await session.scalar(
        select(func.count())
        .select_from(SessionAllocation)
        .join(ClinicalSession, ClinicalSession.id == SessionAllocation.session_id)
        .where(
            SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
            ClinicalSession.id != clinical_session.id,
            ClinicalSession.clinic_id == clinical_session.clinic_id,
            ClinicalSession.status != ClinicalSessionStatus.CANCELLED.value,
            ClinicalSession.starts_at < clinical_session.ends_at,
            ClinicalSession.ends_at > clinical_session.starts_at,
        )
    )
    if int(current_count or 0) + int(other_clinic_count or 0) >= config.max_students:
        raise ApiError(
            409,
            'PHYSICAL_CAPACITY_REACHED',
            'O limite de estudantes da clinica foi atingido.',
        )
    allocation = SessionAllocation(
        session_id=clinical_session.id,
        student_id=student_id,
        status=SessionAllocationStatus.ACTIVE.value,
    )
    session.add(allocation)
    await commit_or_duplicate(session)
    await session.refresh(allocation)
    return SessionAllocationRead.model_validate(allocation)


@router.delete(
    '/sessions/{session_id}/allocations/{allocation_id}',
    response_model=SessionAllocationRead,
)
async def cancel_allocation(
    session_id: UUID,
    allocation_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: CurrentUser,
) -> SessionAllocationRead:
    clinical_session = await load_session(session, session_id, for_update=True)
    allocation = await session.get(SessionAllocation, allocation_id)
    if allocation is None or allocation.session_id != clinical_session.id:
        raise not_found('Alocacao')
    if (
        current_user.role != Role.MASTER.value
        and allocation.student_id != current_user.id
    ):
        raise not_found('Alocacao')
    if allocation.status == SessionAllocationStatus.CANCELLED.value:
        raise invalid_state('A alocacao ja esta cancelada.')
    allocation.status = SessionAllocationStatus.CANCELLED.value
    allocation.suspended_reason = None
    await session.commit()
    await session.refresh(allocation)
    return SessionAllocationRead.model_validate(allocation)
