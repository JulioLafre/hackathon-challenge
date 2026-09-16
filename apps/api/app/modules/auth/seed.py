import asyncio
from datetime import date, time

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, get_settings
from app.core.security import hash_password
from app.db.models import (
    AcademicTerm,
    ClassBlock,
    Clinic,
    ClinicalService,
    ClinicTermConfig,
    Cohort,
    Course,
    Discipline,
    DisciplineKind,
    DocumentRequirement,
    Environment,
    EnvironmentEquipment,
    EquipmentType,
    Role,
    Room,
    ServiceEquipmentRequirement,
    Student,
    StudentAcademicLink,
    StudentAvailability,
    Supervisor,
    SupervisorAvailability,
    SupervisorKind,
    SupervisorServiceScope,
    TermStatus,
    User,
)
from app.db.session import create_engine, create_session_factory


async def seed_users(
    session_factory: async_sessionmaker[AsyncSession], settings: Settings
) -> None:
    demo_users = (
        (settings.demo_master_email, settings.demo_master_password, Role.MASTER),
        (
            settings.demo_supervisor_email,
            settings.demo_supervisor_password,
            Role.SUPERVISOR,
        ),
        (settings.demo_student_email, settings.demo_student_password, Role.STUDENT),
    )
    async with session_factory.begin() as session:
        for email, password, role in demo_users:
            normalized_email = email.strip().lower()
            user = await session.scalar(
                select(User).where(User.email == normalized_email)
            )
            if user is None:
                session.add(
                    User(
                        email=normalized_email,
                        password_hash=hash_password(password),
                        role=role.value,
                        is_active=True,
                    )
                )
                continue

            user.password_hash = hash_password(password)
            user.role = role.value
            user.is_active = True

        await session.flush()
        await seed_academic_demo(session, settings)


async def seed_academic_demo(
    session: AsyncSession,
    settings: Settings,
) -> None:
    student_user = await session.scalar(
        select(User).where(User.email == settings.demo_student_email.lower())
    )
    supervisor_user = await session.scalar(
        select(User).where(User.email == settings.demo_supervisor_email.lower())
    )
    if student_user is None or supervisor_user is None:
        return

    student = await session.get(Student, student_user.id)
    if student is None:
        student = Student(
            user_id=student_user.id,
            registration='FISIO-DEMO-001',
            full_name='Estudante Fisioterapia Demo',
        )
        session.add(student)

    supervisor = await session.get(Supervisor, supervisor_user.id)
    if supervisor is None:
        supervisor = Supervisor(
            user_id=supervisor_user.id,
            kind=SupervisorKind.PRECEPTOR.value,
            full_name='Supervisor Fisioterapia Demo',
            professional_area='Fisioterapia',
            max_students_default=4,
        )
        session.add(supervisor)
    await session.flush()

    term = await session.scalar(
        select(AcademicTerm).where(AcademicTerm.name == '2026.2')
    )
    if term is None:
        term = AcademicTerm(
            name='2026.2',
            starts_on=date(2026, 8, 1),
            ends_on=date(2026, 12, 20),
            status=TermStatus.DRAFT.value,
        )
        session.add(term)
        await session.flush()
    await session.execute(
        update(AcademicTerm)
        .where(
            AcademicTerm.status == TermStatus.ACTIVE.value,
            AcademicTerm.id != term.id,
        )
        .values(status=TermStatus.CLOSED.value)
    )
    term.status = TermStatus.ACTIVE.value

    course = await session.scalar(
        select(Course).where(Course.code == 'FISIO')
    )
    if course is None:
        course = Course(name='Fisioterapia', code='FISIO')
        session.add(course)
        await session.flush()

    discipline = await session.scalar(
        select(Discipline).where(Discipline.code == 'FISIO-PS')
    )
    if discipline is None:
        discipline = Discipline(
            course_id=course.id,
            name='Pratica supervisionada',
            code='FISIO-PS',
            kind=DisciplineKind.INTERNSHIP.value,
        )
        session.add(discipline)
        await session.flush()

    document_requirement = await session.scalar(
        select(DocumentRequirement).where(
            DocumentRequirement.term_id == term.id,
            DocumentRequirement.discipline_id == discipline.id,
            DocumentRequirement.name == 'Comprovante academico ficticio',
        )
    )
    if document_requirement is None:
        session.add(
            DocumentRequirement(
                term_id=term.id,
                discipline_id=discipline.id,
                name='Comprovante academico ficticio',
                expires_required=True,
            )
        )

    cohort = await session.scalar(
        select(Cohort).where(
            Cohort.term_id == term.id,
            Cohort.course_id == course.id,
            Cohort.label == 'FISIO-5A',
        )
    )
    if cohort is None:
        cohort = Cohort(
            term_id=term.id,
            course_id=course.id,
            period=5,
            label='FISIO-5A',
        )
        session.add(cohort)
        await session.flush()

    block = await session.scalar(
        select(ClassBlock).where(
            ClassBlock.cohort_id == cohort.id,
            ClassBlock.weekday == 1,
            ClassBlock.start_time == time(9, 0),
        )
    )
    if block is None:
        session.add(
            ClassBlock(
                cohort_id=cohort.id,
                discipline_id=discipline.id,
                weekday=1,
                start_time=time(9, 0),
                end_time=time(10, 0),
            )
        )

    link = await session.scalar(
        select(StudentAcademicLink).where(
            StudentAcademicLink.student_id == student.user_id,
            StudentAcademicLink.term_id == term.id,
            StudentAcademicLink.discipline_id == discipline.id,
        )
    )
    if link is None:
        session.add(
            StudentAcademicLink(
                student_id=student.user_id,
                term_id=term.id,
                cohort_id=cohort.id,
                discipline_id=discipline.id,
            )
        )

    student_availability = await session.scalar(
        select(StudentAvailability).where(
            StudentAvailability.student_id == student.user_id,
            StudentAvailability.term_id == term.id,
            StudentAvailability.weekday == 2,
            StudentAvailability.start_time == time(8, 0),
        )
    )
    if student_availability is None:
        session.add(
            StudentAvailability(
                student_id=student.user_id,
                term_id=term.id,
                weekday=2,
                start_time=time(8, 0),
                end_time=time(12, 0),
            )
        )

    supervisor_availability = await session.scalar(
        select(SupervisorAvailability).where(
            SupervisorAvailability.supervisor_id == supervisor.user_id,
            SupervisorAvailability.term_id == term.id,
            SupervisorAvailability.weekday == 2,
            SupervisorAvailability.start_time == time(8, 0),
        )
    )
    if supervisor_availability is None:
        session.add(
            SupervisorAvailability(
                supervisor_id=supervisor.user_id,
                term_id=term.id,
                weekday=2,
                start_time=time(8, 0),
                end_time=time(12, 0),
            )
        )

    clinic = await session.scalar(
        select(Clinic).where(Clinic.name == 'Clinica Escola Fisio')
    )
    if clinic is None:
        clinic = Clinic(
            name='Clinica Escola Fisio',
            address_label='Unidade central',
        )
        session.add(clinic)
        await session.flush()

    environment = await session.scalar(
        select(Environment).where(
            Environment.clinic_id == clinic.id,
            Environment.name == 'Ambulatorio Fisioterapia',
        )
    )
    if environment is None:
        environment = Environment(
            clinic_id=clinic.id,
            name='Ambulatorio Fisioterapia',
        )
        session.add(environment)
        await session.flush()

    for room_name in ('Sala 01', 'Sala 02'):
        room = await session.scalar(
            select(Room).where(
                Room.environment_id == environment.id,
                Room.name == room_name,
            )
        )
        if room is None:
            session.add(Room(environment_id=environment.id, name=room_name))

    equipment_type = await session.scalar(
        select(EquipmentType).where(EquipmentType.name == 'Maca')
    )
    if equipment_type is None:
        equipment_type = EquipmentType(name='Maca')
        session.add(equipment_type)
        await session.flush()

    environment_equipment = await session.scalar(
        select(EnvironmentEquipment).where(
            EnvironmentEquipment.environment_id == environment.id,
            EnvironmentEquipment.equipment_type_id == equipment_type.id,
        )
    )
    if environment_equipment is None:
        session.add(
            EnvironmentEquipment(
                environment_id=environment.id,
                equipment_type_id=equipment_type.id,
                quantity=5,
            )
        )

    clinic_config = await session.scalar(
        select(ClinicTermConfig).where(
            ClinicTermConfig.clinic_id == clinic.id,
            ClinicTermConfig.term_id == term.id,
        )
    )
    if clinic_config is None:
        session.add(
            ClinicTermConfig(
                clinic_id=clinic.id,
                term_id=term.id,
                max_simultaneous_appointments=2,
                max_students=4,
            )
        )

    service = await session.scalar(
        select(ClinicalService).where(
            ClinicalService.discipline_id == discipline.id,
            ClinicalService.name == 'Avaliacao fisioterapeutica',
        )
    )
    if service is None:
        service = ClinicalService(
            discipline_id=discipline.id,
            name='Avaliacao fisioterapeutica',
            duration_minutes=60,
        )
        session.add(service)
        await session.flush()

    requirement = await session.scalar(
        select(ServiceEquipmentRequirement).where(
            ServiceEquipmentRequirement.service_id == service.id,
            ServiceEquipmentRequirement.equipment_type_id == equipment_type.id,
        )
    )
    if requirement is None:
        session.add(
            ServiceEquipmentRequirement(
                service_id=service.id,
                equipment_type_id=equipment_type.id,
                units_per_appointment=1,
            )
        )

    scope = await session.scalar(
        select(SupervisorServiceScope).where(
            SupervisorServiceScope.supervisor_id == supervisor.user_id,
            SupervisorServiceScope.term_id == term.id,
            SupervisorServiceScope.service_id == service.id,
            SupervisorServiceScope.environment_id == environment.id,
        )
    )
    if scope is None:
        session.add(
            SupervisorServiceScope(
                supervisor_id=supervisor.user_id,
                term_id=term.id,
                service_id=service.id,
                environment_id=environment.id,
                can_review_documents=False,
                max_students_override=2,
            )
        )


async def run_seed() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    session_factory = create_session_factory(engine)
    try:
        await seed_users(session_factory, settings)
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(run_seed())


if __name__ == "__main__":
    main()
