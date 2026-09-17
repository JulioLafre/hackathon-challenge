from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    Appointment,
    AppointmentRiskStatus,
    AppointmentSlot,
    AppointmentStatus,
    ClassBlock,
    ClinicalService,
    ClinicalSession,
    ClinicalSessionStatus,
    ClinicTermConfig,
    Cohort,
    Course,
    Discipline,
    EnvironmentEquipment,
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
)
from app.modules.documents.services import StudentEligibility

LOCAL_ZONE = ZoneInfo('America/Sao_Paulo')
CAPACITY_KEYS = (
    'eligible_students',
    'supervision',
    'rooms',
    'equipment',
    'clinic_appointments',
)


@dataclass(frozen=True)
class CapacityExplanation:
    effective: int
    constraints: dict[str, int]
    limiting_factors: list[str]

    def as_dict(self) -> dict[str, object]:
        return {
            'effective': self.effective,
            'constraints': self.constraints,
            'limiting_factors': self.limiting_factors,
        }


def explain_capacity(constraints: dict[str, int]) -> CapacityExplanation:
    values = [max(0, constraints[key]) for key in CAPACITY_KEYS]
    effective = min(values)
    limiting_factors = [
        key for key in CAPACITY_KEYS if max(0, constraints[key]) == effective
    ]
    return CapacityExplanation(effective, constraints, limiting_factors)


def local_interval(
    starts_at: datetime,
    ends_at: datetime,
) -> tuple[int, time, time]:
    local_start = starts_at.astimezone(LOCAL_ZONE)
    local_end = ends_at.astimezone(LOCAL_ZONE)
    if local_start.date() != local_end.date():
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'A sessao deve iniciar e terminar no mesmo dia institucional.',
        )
    weekday = (local_start.weekday() + 1) % 7
    return weekday, local_start.time(), local_end.time()


async def ensure_student_compatibility(
    session: AsyncSession,
    clinical_session: ClinicalSession,
    student_id: UUID,
) -> StudentAcademicLink:
    student = await session.get(Student, student_id)
    if student is None:
        raise ApiError(404, 'NOT_FOUND', 'Estudante nao encontrado.')

    service = await session.get(ClinicalService, clinical_session.service_id)
    if service is None:
        raise ApiError(422, 'VALIDATION_ERROR', 'Servico nao encontrado.')
    link = await session.scalar(
        select(StudentAcademicLink)
        .join(
            AcademicTerm,
            AcademicTerm.id == StudentAcademicLink.term_id,
        )
        .where(
            StudentAcademicLink.student_id == student_id,
            StudentAcademicLink.term_id == clinical_session.term_id,
            StudentAcademicLink.discipline_id == service.discipline_id,
        )
    )
    if link is None:
        raise ApiError(
            409,
            'ACADEMIC_CONFLICT',
            'O vinculo academico nao e compativel com o servico.',
        )
    discipline_course_id = await session.scalar(
        select(Course.id)
        .join(Discipline, Discipline.course_id == Course.id)
        .where(Discipline.id == service.discipline_id)
    )
    cohort_course = await session.scalar(
        select(Cohort.course_id).where(Cohort.id == link.cohort_id)
    )
    if discipline_course_id != cohort_course:
        raise ApiError(
            409,
            'ACADEMIC_CONFLICT',
            'Curso e disciplina do vinculo nao sao compativeis.',
        )

    weekday, start_time, end_time = local_interval(
        clinical_session.starts_at,
        clinical_session.ends_at,
    )
    available = await session.scalar(
        select(StudentAvailability.id).where(
            StudentAvailability.student_id == student_id,
            StudentAvailability.term_id == clinical_session.term_id,
            StudentAvailability.weekday == weekday,
            StudentAvailability.start_time <= start_time,
            StudentAvailability.end_time >= end_time,
        )
    )
    if available is None:
        raise ApiError(
            409,
            'ACADEMIC_CONFLICT',
            'O estudante nao cobre todo o intervalo da sessao.',
        )

    blocked = await session.scalar(
        select(ClassBlock.id).where(
            ClassBlock.cohort_id == link.cohort_id,
            ClassBlock.is_active.is_(True),
            ClassBlock.weekday == weekday,
            ClassBlock.start_time < end_time,
            ClassBlock.end_time > start_time,
            or_(
                ClassBlock.discipline_id.is_(None),
                ClassBlock.discipline_id == service.discipline_id,
            ),
        )
    )
    if blocked is not None:
        raise ApiError(
            409,
            'ACADEMIC_CONFLICT',
            'O horario da sessao conflita com a grade academica.',
        )

    other_allocation = await session.scalar(
        select(SessionAllocation.id)
        .join(ClinicalSession, ClinicalSession.id == SessionAllocation.session_id)
        .where(
            SessionAllocation.student_id == student_id,
            SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
            ClinicalSession.id != clinical_session.id,
            ClinicalSession.status != ClinicalSessionStatus.CANCELLED.value,
            ClinicalSession.starts_at < clinical_session.ends_at,
            ClinicalSession.ends_at > clinical_session.starts_at,
        )
    )
    if other_allocation is not None:
        raise ApiError(
            409,
            'ACADEMIC_CONFLICT',
            'O estudante ja possui outra alocacao no intervalo.',
        )
    return link


async def ensure_supervisor_availability(
    session: AsyncSession,
    clinical_session: ClinicalSession,
) -> None:
    weekday, start_time, end_time = local_interval(
        clinical_session.starts_at,
        clinical_session.ends_at,
    )
    available = await session.scalar(
        select(SupervisorAvailability.id).where(
            SupervisorAvailability.supervisor_id == clinical_session.supervisor_id,
            SupervisorAvailability.term_id == clinical_session.term_id,
            SupervisorAvailability.weekday == weekday,
            SupervisorAvailability.start_time <= start_time,
            SupervisorAvailability.end_time >= end_time,
        )
    )
    if available is None:
        raise ApiError(
            409,
            'SUPERVISOR_SCHEDULE_CONFLICT',
            'O supervisor nao cobre todo o intervalo da sessao.',
        )
    conflict = await session.scalar(
        select(ClinicalSession.id).where(
            ClinicalSession.supervisor_id == clinical_session.supervisor_id,
            ClinicalSession.id != clinical_session.id,
            ClinicalSession.status != ClinicalSessionStatus.CANCELLED.value,
            ClinicalSession.starts_at < clinical_session.ends_at,
            ClinicalSession.ends_at > clinical_session.starts_at,
        )
    )
    if conflict is not None:
        raise ApiError(
            409,
            'SUPERVISOR_SCHEDULE_CONFLICT',
            'O supervisor ja possui uma sessao no intervalo.',
        )


async def _active_overlapping_allocations(
    session: AsyncSession,
    clinical_session: ClinicalSession,
    *,
    clinic_id: UUID | None = None,
    environment_id: UUID | None = None,
    supervisor_id: UUID | None = None,
) -> list[SessionAllocation]:
    conditions = [
        SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
        ClinicalSession.id != clinical_session.id,
        ClinicalSession.status != ClinicalSessionStatus.CANCELLED.value,
        ClinicalSession.starts_at < clinical_session.ends_at,
        ClinicalSession.ends_at > clinical_session.starts_at,
    ]
    if clinic_id is not None:
        conditions.append(ClinicalSession.clinic_id == clinic_id)
    if environment_id is not None:
        conditions.append(ClinicalSession.environment_id == environment_id)
    if supervisor_id is not None:
        conditions.append(ClinicalSession.supervisor_id == supervisor_id)
    return list(
        await session.scalars(
            select(SessionAllocation)
            .join(ClinicalSession, ClinicalSession.id == SessionAllocation.session_id)
            .where(and_(*conditions))
        )
    )


async def calculate_capacity(
    session: AsyncSession,
    clinical_session: ClinicalSession,
    *,
    now: datetime | None = None,
) -> CapacityExplanation:
    allocations = list(
        await session.scalars(
            select(SessionAllocation).where(
                SessionAllocation.session_id == clinical_session.id,
                SessionAllocation.status.in_(
                    [
                        SessionAllocationStatus.ACTIVE.value,
                        SessionAllocationStatus.SUSPENDED.value,
                    ]
                ),
            )
        )
    )
    eligible_students = 0
    eligibility = StudentEligibility()
    for allocation in allocations:
        result = await eligibility.evaluate(
            session,
            allocation.student_id,
            clinical_session.term_id,
            now=now,
        )
        if result.eligible:
            eligible_students += 1
            if (
                allocation.status
                == SessionAllocationStatus.SUSPENDED.value
            ):
                allocation.status = SessionAllocationStatus.ACTIVE.value
                allocation.suspended_reason = None
        else:
            if allocation.status == SessionAllocationStatus.ACTIVE.value:
                allocation.status = SessionAllocationStatus.SUSPENDED.value
                allocation.suspended_reason = 'DOCUMENTS_PENDING'
    if any(
        allocation.status == SessionAllocationStatus.SUSPENDED.value
        for allocation in allocations
    ):
        await session.flush()

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
    config = await session.scalar(
        select(ClinicTermConfig).where(
            ClinicTermConfig.clinic_id == clinical_session.clinic_id,
            ClinicTermConfig.term_id == clinical_session.term_id,
        )
    )
    if supervisor is None or config is None:
        return explain_capacity(
            {
                'eligible_students': eligible_students,
                'supervision': 0,
                'rooms': 0,
                'equipment': 0,
                'clinic_appointments': 0,
            }
        )

    other_supervisor = await _active_overlapping_allocations(
        session,
        clinical_session,
        supervisor_id=clinical_session.supervisor_id,
    )
    supervision_limit = supervisor.max_students_default
    if scope is not None and scope.max_students_override is not None:
        supervision_limit = min(supervision_limit, scope.max_students_override)
    if clinical_session.max_students_override is not None:
        supervision_limit = min(
            supervision_limit, clinical_session.max_students_override
        )
    supervision = max(0, supervision_limit - len(other_supervisor))

    rooms = list(
        await session.scalars(
            select(Room).where(
                Room.environment_id == clinical_session.environment_id,
                Room.is_active.is_(True),
            )
        )
    )
    other_environment = await _active_overlapping_allocations(
        session,
        clinical_session,
        environment_id=clinical_session.environment_id,
    )
    rooms_available = max(0, len(rooms) - len(other_environment))

    service_requirements = list(
        await session.scalars(
            select(ServiceEquipmentRequirement).where(
                ServiceEquipmentRequirement.service_id == clinical_session.service_id
            )
        )
    )
    equipment_capacity = 10000
    for requirement in service_requirements:
        inventory = await session.scalar(
            select(EnvironmentEquipment).where(
                EnvironmentEquipment.environment_id
                == clinical_session.environment_id,
                EnvironmentEquipment.equipment_type_id
                == requirement.equipment_type_id,
                EnvironmentEquipment.is_active.is_(True),
            )
        )
        if inventory is None:
            equipment_capacity = 0
            continue
        consumed = 0
        for allocation in other_environment:
            other_session = await session.get(
                ClinicalSession, allocation.session_id
            )
            if other_session is None:
                continue
            other_requirements = list(
                await session.scalars(
                    select(ServiceEquipmentRequirement).where(
                        ServiceEquipmentRequirement.service_id
                        == other_session.service_id,
                        ServiceEquipmentRequirement.equipment_type_id
                        == requirement.equipment_type_id,
                    )
                )
            )
            consumed += sum(
                item.units_per_appointment for item in other_requirements
            )
        equipment_capacity = min(
            equipment_capacity,
            max(
                0,
                (inventory.quantity - consumed) // requirement.units_per_appointment,
            ),
        )

    other_clinic = await _active_overlapping_allocations(
        session,
        clinical_session,
        clinic_id=clinical_session.clinic_id,
    )
    clinic_appointments = max(
        0,
        config.max_simultaneous_appointments - len(other_clinic),
    )
    return explain_capacity(
        {
            'eligible_students': eligible_students,
            'supervision': supervision,
            'rooms': rooms_available,
            'equipment': equipment_capacity,
            'clinic_appointments': clinic_appointments,
        }
    )


async def suspend_ineligible_allocations(
    session: AsyncSession,
    *,
    student_id: UUID,
    term_id: UUID,
    reason: str = 'DOCUMENTS_PENDING',
    now: datetime | None = None,
) -> int:
    current_time = now or datetime.now(UTC)
    allocations = list(
        await session.scalars(
            select(SessionAllocation)
            .join(ClinicalSession, ClinicalSession.id == SessionAllocation.session_id)
            .where(
                SessionAllocation.student_id == student_id,
                SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
                ClinicalSession.term_id == term_id,
                ClinicalSession.status.in_(
                    [
                        ClinicalSessionStatus.DRAFT.value,
                        ClinicalSessionStatus.PUBLISHED.value,
                    ]
                ),
                ClinicalSession.starts_at > current_time,
            )
        )
    )
    eligibility = StudentEligibility()
    suspended = 0
    affected_session_ids: set[UUID] = set()
    for allocation in allocations:
        result = await eligibility.evaluate(
            session,
            allocation.student_id,
            term_id,
            now=current_time,
        )
        if not result.eligible:
            allocation.status = SessionAllocationStatus.SUSPENDED.value
            allocation.suspended_reason = reason
            suspended += 1
            affected_session_ids.add(allocation.session_id)
            appointments = await session.scalars(
                select(Appointment).where(
                    Appointment.allocation_id == allocation.id,
                    Appointment.status.in_(
                        [
                            AppointmentStatus.BOOKED.value,
                            AppointmentStatus.CONFIRMED.value,
                        ]
                    ),
                )
            )
            for appointment in appointments:
                appointment.risk_status = AppointmentRiskStatus.AT_RISK.value
    if suspended:
        await session.flush()
        for session_id in affected_session_ids:
            clinical_session = await session.get(ClinicalSession, session_id)
            if clinical_session is None:
                continue
            capacity = await calculate_capacity(
                session,
                clinical_session,
                now=current_time,
            )
            clinical_session.capacity_explanation = capacity.as_dict()
            if clinical_session.status == ClinicalSessionStatus.PUBLISHED.value:
                await materialize_slots(session, clinical_session, capacity)
        await session.flush()
    return suspended


async def materialize_slots(
    session: AsyncSession,
    clinical_session: ClinicalSession,
    capacity: CapacityExplanation,
) -> int:
    service = await session.get(ClinicalService, clinical_session.service_id)
    if service is None:
        raise ApiError(422, 'VALIDATION_ERROR', 'Servico nao encontrado.')
    duration = timedelta(minutes=service.duration_minutes)
    cursor = clinical_session.starts_at
    slots = list(
        await session.scalars(
            select(AppointmentSlot)
            .where(AppointmentSlot.session_id == clinical_session.id)
            .order_by(AppointmentSlot.starts_at)
        )
    )
    expected: list[tuple[datetime, datetime]] = []
    while cursor + duration <= clinical_session.ends_at:
        expected.append((cursor, cursor + duration))
        cursor += duration

    for index, (starts_at, ends_at) in enumerate(expected):
        if index < len(slots):
            slot = slots[index]
            slot.starts_at = starts_at
            slot.ends_at = ends_at
            slot.capacity_total = max(slot.reserved_count, capacity.effective)
            slot.version += 1
        else:
            session.add(
                AppointmentSlot(
                    session_id=clinical_session.id,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    capacity_total=capacity.effective,
                )
            )
    for slot in slots[len(expected) :]:
        if slot.reserved_count > 0:
            slot.capacity_total = slot.reserved_count
        else:
            await session.delete(slot)
    await session.flush()
    return len(expected)
