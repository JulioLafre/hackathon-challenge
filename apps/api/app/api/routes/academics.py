from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    AuditEvent,
    ClassBlock,
    Cohort,
    Course,
    Discipline,
    Role,
    Student,
    StudentAcademicLink,
    StudentAvailability,
    Supervisor,
    SupervisorAvailability,
    TermStatus,
    User,
)
from app.modules.academics.schemas import (
    AvailabilityRead,
    AvailabilityUpdate,
    ManagedAvailabilityUpdate,
    ClassBlockCreate,
    ClassBlockRead,
    CohortCreate,
    CohortRead,
    CohortUpdate,
    CourseCreate,
    CourseRead,
    CourseUpdate,
    DisciplineCreate,
    DisciplineRead,
    DisciplineUpdate,
    IntervalPayload,
    StudentAcademicLinkCreate,
    StudentAcademicLinkRead,
    StudentCreate,
    StudentProfileUpdate,
    StudentRead,
    SupervisorCreate,
    SupervisorRead,
    TermCreate,
    TermRead,
    TermUpdate,
)
from app.modules.academics.services import (
    ensure_class_block_is_available,
    ensure_intervals_are_valid,
)
from app.modules.auth.dependencies import (
    get_db_session,
    require_roles,
)

router = APIRouter(tags=['academics'])
MasterUser = Annotated[User, Depends(require_roles(Role.MASTER))]
StudentUser = Annotated[User, Depends(require_roles(Role.STUDENT))]
AvailabilityUser = Annotated[
    User, Depends(require_roles(Role.STUDENT, Role.SUPERVISOR))
]


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


@router.get('/terms', response_model=list[TermRead])
async def list_terms(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[AcademicTerm]:
    result = await session.scalars(
        select(AcademicTerm).order_by(AcademicTerm.starts_on.desc())
    )
    return list(result)


@router.post('/terms', response_model=TermRead, status_code=status.HTTP_201_CREATED)
async def create_term(
    payload: TermCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> AcademicTerm:
    term = AcademicTerm(
        name=payload.name.strip(),
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        status=TermStatus.DRAFT.value,
    )
    session.add(term)
    await commit_or_duplicate(session)
    await session.refresh(term)
    return term


@router.patch('/terms/{term_id}', response_model=TermRead)
async def update_term(
    term_id: UUID,
    payload: TermUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> AcademicTerm:
    term = await session.get(AcademicTerm, term_id)
    if term is None:
        raise not_found('Semestre')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state('Semestre fechado e somente leitura.')
    term.name = payload.name.strip()
    term.starts_on = payload.starts_on
    term.ends_on = payload.ends_on
    await commit_or_duplicate(session)
    await session.refresh(term)
    return term


@router.post('/terms/{term_id}/activate', response_model=TermRead)
async def activate_term(
    term_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> AcademicTerm:
    term = await session.get(AcademicTerm, term_id, with_for_update=True)
    if term is None:
        raise not_found('Semestre')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state('Semestre fechado nao pode ser reativado.')
    await session.scalars(
        select(AcademicTerm)
        .where(AcademicTerm.status == TermStatus.ACTIVE.value)
        .with_for_update()
    )
    await session.execute(
        update(AcademicTerm)
        .where(
            AcademicTerm.status == TermStatus.ACTIVE.value,
            AcademicTerm.id != term.id,
        )
        .values(status=TermStatus.CLOSED.value)
    )
    term.status = TermStatus.ACTIVE.value
    await commit_or_duplicate(session)
    await session.refresh(term)
    return term


@router.post('/terms/{term_id}/deactivate', response_model=TermRead)
async def deactivate_term(
    term_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> AcademicTerm:
    term = await session.get(AcademicTerm, term_id)
    if term is None:
        raise not_found('Semestre')
    if term.status != TermStatus.ACTIVE.value:
        raise invalid_state('Somente um semestre ativo pode ser desativado.')
    term.status = TermStatus.CLOSED.value
    await session.commit()
    await session.refresh(term)
    return term


@router.get('/courses', response_model=list[CourseRead])
async def list_courses(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Course]:
    result = await session.scalars(select(Course).order_by(Course.name))
    return list(result)


@router.post('/courses', response_model=CourseRead, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Course:
    course = Course(name=payload.name.strip(), code=payload.code.strip().upper())
    session.add(course)
    await commit_or_duplicate(session)
    await session.refresh(course)
    return course


@router.patch('/courses/{course_id}', response_model=CourseRead)
async def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Course:
    course = await session.get(Course, course_id)
    if course is None:
        raise not_found('Curso')
    course.name = payload.name.strip()
    course.code = payload.code.strip().upper()
    await commit_or_duplicate(session)
    await session.refresh(course)
    return course


@router.post('/courses/{course_id}/deactivate', response_model=CourseRead)
async def deactivate_course(
    course_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Course:
    course = await session.get(Course, course_id)
    if course is None:
        raise not_found('Curso')
    course.is_active = False
    await session.commit()
    await session.refresh(course)
    return course


@router.get('/disciplines', response_model=list[DisciplineRead])
async def list_disciplines(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Discipline]:
    result = await session.scalars(select(Discipline).order_by(Discipline.name))
    return list(result)


@router.post(
    '/disciplines',
    response_model=DisciplineRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_discipline(
    payload: DisciplineCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Discipline:
    course = await session.get(Course, payload.course_id)
    if course is None:
        raise not_found('Curso')
    discipline = Discipline(
        course_id=payload.course_id,
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        kind=payload.kind.value,
    )
    session.add(discipline)
    await commit_or_duplicate(session)
    await session.refresh(discipline)
    return discipline


@router.patch('/disciplines/{discipline_id}', response_model=DisciplineRead)
async def update_discipline(
    discipline_id: UUID,
    payload: DisciplineUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Discipline:
    discipline = await session.get(Discipline, discipline_id)
    if discipline is None:
        raise not_found('Disciplina')
    if await session.get(Course, payload.course_id) is None:
        raise not_found('Curso')
    discipline.course_id = payload.course_id
    discipline.name = payload.name.strip()
    discipline.code = payload.code.strip().upper()
    discipline.kind = payload.kind.value
    await commit_or_duplicate(session)
    await session.refresh(discipline)
    return discipline


@router.post('/disciplines/{discipline_id}/deactivate', response_model=DisciplineRead)
async def deactivate_discipline(
    discipline_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Discipline:
    discipline = await session.get(Discipline, discipline_id)
    if discipline is None:
        raise not_found('Disciplina')
    discipline.is_active = False
    await session.commit()
    await session.refresh(discipline)
    return discipline


@router.get('/cohorts', response_model=list[CohortRead])
async def list_cohorts(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    term_id: Annotated[UUID | None, Query()] = None,
) -> list[Cohort]:
    query = select(Cohort).order_by(Cohort.period, Cohort.label)
    if term_id is not None:
        query = query.where(Cohort.term_id == term_id)
    result = await session.scalars(query)
    return list(result)


@router.post('/cohorts', response_model=CohortRead, status_code=status.HTTP_201_CREATED)
async def create_cohort(
    payload: CohortCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Cohort:
    if await session.get(AcademicTerm, payload.term_id) is None:
        raise not_found('Semestre')
    if await session.get(Course, payload.course_id) is None:
        raise not_found('Curso')
    cohort = Cohort(
        term_id=payload.term_id,
        course_id=payload.course_id,
        period=payload.period,
        label=payload.label.strip(),
    )
    session.add(cohort)
    await commit_or_duplicate(session)
    await session.refresh(cohort)
    return cohort


@router.patch('/cohorts/{cohort_id}', response_model=CohortRead)
async def update_cohort(
    cohort_id: UUID,
    payload: CohortUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Cohort:
    cohort = await session.get(Cohort, cohort_id)
    if cohort is None:
        raise not_found('Turma')
    if await session.get(AcademicTerm, payload.term_id) is None:
        raise not_found('Semestre')
    if await session.get(Course, payload.course_id) is None:
        raise not_found('Curso')
    cohort.term_id = payload.term_id
    cohort.course_id = payload.course_id
    cohort.period = payload.period
    cohort.label = payload.label.strip()
    await commit_or_duplicate(session)
    await session.refresh(cohort)
    return cohort


@router.post('/cohorts/{cohort_id}/deactivate', response_model=CohortRead)
async def deactivate_cohort(
    cohort_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Cohort:
    cohort = await session.get(Cohort, cohort_id)
    if cohort is None:
        raise not_found('Turma')
    cohort.is_active = False
    await session.commit()
    await session.refresh(cohort)
    return cohort


@router.get('/class-blocks', response_model=list[ClassBlockRead])
async def list_class_blocks(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    cohort_id: Annotated[UUID | None, Query()] = None,
) -> list[ClassBlock]:
    query = select(ClassBlock).where(ClassBlock.is_active.is_(True))
    if cohort_id is not None:
        query = query.where(ClassBlock.cohort_id == cohort_id)
    result = await session.scalars(
        query.order_by(ClassBlock.weekday, ClassBlock.start_time)
    )
    return list(result)


@router.post(
    '/class-blocks',
    response_model=ClassBlockRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_class_block(
    payload: ClassBlockCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClassBlock:
    cohort = await session.get(Cohort, payload.cohort_id)
    if cohort is None:
        raise not_found('Turma')
    if payload.discipline_id is not None:
        discipline = await session.get(Discipline, payload.discipline_id)
        if discipline is None:
            raise not_found('Disciplina')
        if discipline.course_id != cohort.course_id:
            raise ApiError(
                422,
                'VALIDATION_ERROR',
                'A disciplina nao pertence ao curso da turma.',
            )
    await ensure_class_block_is_available(
        session,
        cohort_id=payload.cohort_id,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    block = ClassBlock(
        cohort_id=payload.cohort_id,
        discipline_id=payload.discipline_id,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        time_zone=payload.time_zone,
    )
    session.add(block)
    await commit_or_duplicate(session)
    await session.refresh(block)
    return block


@router.get('/students', response_model=list[StudentRead])
async def list_students(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Student]:
    result = await session.scalars(select(Student).order_by(Student.full_name))
    return list(result)


@router.post(
    '/students',
    response_model=StudentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    payload: StudentCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Student:
    user = await session.get(User, payload.user_id)
    if user is None or user.role != Role.STUDENT.value:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O usuario informado precisa ter o papel STUDENT.',
        )
    if await session.get(Student, payload.user_id) is not None:
        raise ApiError(409, 'DUPLICATE_RESOURCE', 'O perfil de estudante ja existe.')
    student = Student(
        user_id=payload.user_id,
        registration=payload.registration.strip(),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
    )
    session.add(student)
    await commit_or_duplicate(session)
    await session.refresh(student)
    return student


@router.patch('/students/{student_id}', response_model=StudentRead)
async def update_student(
    student_id: UUID,
    payload: StudentCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Student:
    student = await session.get(Student, student_id)
    if student is None:
        raise not_found('Estudante')
    if payload.user_id != student_id:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O user_id nao pode mudar em um perfil existente.',
        )
    student.registration = payload.registration.strip()
    student.full_name = payload.full_name.strip()
    student.phone = payload.phone.strip() if payload.phone else None
    await commit_or_duplicate(session)
    await session.refresh(student)
    return student


@router.get('/me/student', response_model=StudentRead)
async def get_my_student_profile(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: StudentUser,
) -> Student:
    student = await session.get(Student, current_user.id)
    if student is None:
        raise ApiError(
            409,
            'PROFILE_REQUIRED',
            'O perfil de estudante ainda nao foi criado.',
        )
    return student


@router.patch('/me/student', response_model=StudentRead)
async def update_my_student_profile(
    payload: StudentProfileUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: StudentUser,
) -> Student:
    student = await session.get(Student, current_user.id)
    if student is None:
        raise ApiError(
            409,
            'PROFILE_REQUIRED',
            'O perfil de estudante ainda nao foi criado.',
        )
    student.registration = payload.registration.strip()
    student.full_name = payload.full_name.strip()
    student.phone = payload.phone.strip() if payload.phone else None
    await commit_or_duplicate(session)
    await session.refresh(student)
    return student


@router.get('/supervisors', response_model=list[SupervisorRead])
async def list_supervisors(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Supervisor]:
    result = await session.scalars(
        select(Supervisor).order_by(Supervisor.full_name)
    )
    return list(result)


@router.post(
    '/supervisors',
    response_model=SupervisorRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_supervisor(
    payload: SupervisorCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Supervisor:
    user = await session.get(User, payload.user_id)
    if user is None or user.role != Role.SUPERVISOR.value:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O usuario informado precisa ter o papel SUPERVISOR.',
        )
    if await session.get(Supervisor, payload.user_id) is not None:
        raise ApiError(
            409, 'DUPLICATE_RESOURCE', 'O perfil de supervisor ja existe.'
        )
    supervisor = Supervisor(
        user_id=payload.user_id,
        kind=payload.kind.value,
        full_name=payload.full_name.strip(),
        professional_area=payload.professional_area.strip(),
        max_students_default=payload.max_students_default,
    )
    session.add(supervisor)
    await commit_or_duplicate(session)
    await session.refresh(supervisor)
    return supervisor


@router.patch('/supervisors/{supervisor_id}', response_model=SupervisorRead)
async def update_supervisor(
    supervisor_id: UUID,
    payload: SupervisorCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Supervisor:
    supervisor = await session.get(Supervisor, supervisor_id)
    if supervisor is None:
        raise not_found('Supervisor')
    if payload.user_id != supervisor_id:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O user_id nao pode mudar em um perfil existente.',
        )
    supervisor.kind = payload.kind.value
    supervisor.full_name = payload.full_name.strip()
    supervisor.professional_area = payload.professional_area.strip()
    supervisor.max_students_default = payload.max_students_default
    await session.commit()
    await session.refresh(supervisor)
    return supervisor


@router.get(
    '/student-academic-links',
    response_model=list[StudentAcademicLinkRead],
)
async def list_student_academic_links(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    student_id: Annotated[UUID | None, Query()] = None,
) -> list[StudentAcademicLinkRead]:
    query = (
        select(StudentAcademicLink, AcademicTerm.status)
        .join(AcademicTerm, AcademicTerm.id == StudentAcademicLink.term_id)
        .order_by(StudentAcademicLink.created_at)
    )
    if student_id is not None:
        query = query.where(StudentAcademicLink.student_id == student_id)
    rows = (await session.execute(query)).all()
    return [
        StudentAcademicLinkRead(
            id=link.id,
            student_id=link.student_id,
            term_id=link.term_id,
            term_status=term_status,
            cohort_id=link.cohort_id,
            discipline_id=link.discipline_id,
        )
        for link, term_status in rows
    ]


@router.post(
    '/student-academic-links',
    response_model=StudentAcademicLinkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_student_academic_link(
    payload: StudentAcademicLinkCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> StudentAcademicLinkRead:
    student = await session.get(Student, payload.student_id)
    term = await session.get(AcademicTerm, payload.term_id)
    cohort = await session.get(Cohort, payload.cohort_id)
    discipline = await session.get(Discipline, payload.discipline_id)
    if student is None:
        raise not_found('Estudante')
    if term is None:
        raise not_found('Semestre')
    if cohort is None:
        raise not_found('Turma')
    if discipline is None:
        raise not_found('Disciplina')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state('Nao e possivel criar vinculo em semestre fechado.')
    if cohort.term_id != term.id or cohort.course_id != discipline.course_id:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'Turma, semestre e disciplina nao sao compativeis.',
        )
    link = StudentAcademicLink(
        student_id=payload.student_id,
        term_id=payload.term_id,
        cohort_id=payload.cohort_id,
        discipline_id=payload.discipline_id,
    )
    session.add(link)
    await commit_or_duplicate(session)
    await session.refresh(link)
    return StudentAcademicLinkRead(
        id=link.id,
        student_id=link.student_id,
        term_id=link.term_id,
        term_status=TermStatus(term.status),
        cohort_id=link.cohort_id,
        discipline_id=link.discipline_id,
    )


async def availability_response(
    session: AsyncSession,
    *,
    user: User,
    term_id: UUID,
) -> AvailabilityRead:
    profile: Any
    model: Any
    owner_column: Any
    if user.role == Role.STUDENT.value:
        profile = await session.get(Student, user.id)
        model = StudentAvailability
        owner_type = Role.STUDENT.value
        owner_column = StudentAvailability.student_id
    else:
        profile = await session.get(Supervisor, user.id)
        model = SupervisorAvailability
        owner_type = Role.SUPERVISOR.value
        owner_column = SupervisorAvailability.supervisor_id
    if profile is None:
        raise ApiError(
            409,
            'PROFILE_REQUIRED',
            'O perfil academico precisa ser criado pelo Master antes da '
            'disponibilidade.',
        )
    rows = await session.scalars(
        select(model)
        .where(owner_column == user.id, model.term_id == term_id)
        .order_by(model.weekday, model.start_time)
    )
    intervals = [
        IntervalPayload(
            weekday=row.weekday,
            start_time=row.start_time,
            end_time=row.end_time,
            time_zone=row.time_zone,
        )
        for row in rows
    ]
    return AvailabilityRead(
        owner_type=owner_type,
        term_id=term_id,
        time_zone='America/Sao_Paulo',
        intervals=intervals,
    )


@router.get('/me/academic-terms', response_model=list[TermRead])
async def list_my_academic_terms(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: AvailabilityUser,
) -> list[AcademicTerm]:
    result = await session.scalars(
        select(AcademicTerm)
        .where(
            AcademicTerm.status.in_(
                [TermStatus.DRAFT.value, TermStatus.ACTIVE.value]
            )
        )
        .order_by(AcademicTerm.starts_on.desc())
    )
    return list(result)


@router.get('/me/availability', response_model=AvailabilityRead)
async def get_my_availability(
    term_id: Annotated[UUID, Query()],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: AvailabilityUser,
) -> AvailabilityRead:
    if await session.get(AcademicTerm, term_id) is None:
        raise not_found('Semestre')
    return await availability_response(
        session, user=current_user, term_id=term_id
    )


@router.put('/me/availability', response_model=AvailabilityRead)
async def replace_my_availability(
    payload: AvailabilityUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: AvailabilityUser,
) -> AvailabilityRead:
    term = await session.get(AcademicTerm, payload.term_id)
    if term is None:
        raise not_found('Semestre')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state(
            'Nao e possivel editar disponibilidade de semestre '
            'fechado.'
        )
    ensure_intervals_are_valid(payload.intervals)

    profile: Any
    model: Any
    owner_column: Any
    owner_field: str
    if current_user.role == Role.STUDENT.value:
        profile = await session.get(Student, current_user.id)
        model = StudentAvailability
        owner_column = StudentAvailability.student_id
        owner_field = 'student_id'
    else:
        profile = await session.get(Supervisor, current_user.id)
        model = SupervisorAvailability
        owner_column = SupervisorAvailability.supervisor_id
        owner_field = 'supervisor_id'
    if profile is None:
        raise ApiError(
            409,
            'PROFILE_REQUIRED',
            'O perfil academico precisa ser criado pelo Master antes da '
            'disponibilidade.',
        )

    await session.execute(
        delete(model).where(
            owner_column == current_user.id,
            model.term_id == payload.term_id,
        )
    )
    for interval in payload.intervals:
        session.add(
            model(
                **{
                    owner_field: current_user.id,
                    'term_id': payload.term_id,
                    'weekday': interval.weekday,
                    'start_time': interval.start_time,
                    'end_time': interval.end_time,
                    'time_zone': interval.time_zone,
                }
            )
        )
    await session.commit()
    return await availability_response(
        session, user=current_user, term_id=payload.term_id
    )


async def load_managed_availability_target(
    session: AsyncSession,
    *,
    user_id: UUID,
    owner_type: str,
) -> User:
    user = await session.get(User, user_id)
    if user is None or user.role != owner_type:
        raise not_found('Perfil de disponibilidade')
    profile_model = Student if owner_type == Role.STUDENT.value else Supervisor
    if await session.get(profile_model, user_id) is None:
        raise ApiError(
            409,
            'PROFILE_REQUIRED',
            'O perfil academico precisa ser criado antes da disponibilidade.',
        )
    return user


@router.get('/managed-availability', response_model=AvailabilityRead)
async def get_managed_availability(
    user_id: Annotated[UUID, Query()],
    owner_type: Annotated[str, Query(pattern='^(STUDENT|SUPERVISOR)$')],
    term_id: Annotated[UUID, Query()],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> AvailabilityRead:
    target = await load_managed_availability_target(
        session, user_id=user_id, owner_type=owner_type
    )
    if await session.get(AcademicTerm, term_id) is None:
        raise not_found('Semestre')
    return await availability_response(session, user=target, term_id=term_id)


@router.put('/managed-availability', response_model=AvailabilityRead)
async def replace_managed_availability(
    payload: ManagedAvailabilityUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: MasterUser,
) -> AvailabilityRead:
    target = await load_managed_availability_target(
        session, user_id=payload.user_id, owner_type=payload.owner_type
    )
    term = await session.get(AcademicTerm, payload.term_id)
    if term is None:
        raise not_found('Semestre')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state(
            'Nao e possivel editar disponibilidade de semestre fechado.'
        )
    ensure_intervals_are_valid(payload.intervals)

    if payload.owner_type == Role.STUDENT.value:
        model = StudentAvailability
        owner_column = StudentAvailability.student_id
        owner_field = 'student_id'
        target_type = 'student_availability'
    else:
        model = SupervisorAvailability
        owner_column = SupervisorAvailability.supervisor_id
        owner_field = 'supervisor_id'
        target_type = 'supervisor_availability'

    await session.execute(
        delete(model).where(
            owner_column == target.id,
            model.term_id == payload.term_id,
        )
    )
    for interval in payload.intervals:
        session.add(
            model(
                **{
                    owner_field: target.id,
                    'term_id': payload.term_id,
                    'weekday': interval.weekday,
                    'start_time': interval.start_time,
                    'end_time': interval.end_time,
                    'time_zone': interval.time_zone,
                }
            )
        )
    session.add(
        AuditEvent(
            actor_user_id=current_user.id,
            action='AVAILABILITY_UPDATED',
            target_type=target_type,
            target_id=target.id,
            metadata_json={'term_id': str(payload.term_id)},
        )
    )
    await session.commit()
    return await availability_response(session, user=target, term_id=payload.term_id)
