from datetime import date, datetime, time
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

INSTITUTIONAL_TIME_ZONE = 'America/Sao_Paulo'


class TermStatus(StrEnum):
    DRAFT = 'DRAFT'
    ACTIVE = 'ACTIVE'
    CLOSED = 'CLOSED'


class DisciplineKind(StrEnum):
    DISCIPLINE = 'DISCIPLINE'
    INTERNSHIP = 'INTERNSHIP'


class SupervisorKind(StrEnum):
    PROFESSOR = 'PROFESSOR'
    PRECEPTOR = 'PRECEPTOR'


def uuid_column() -> Mapped[UUID]:
    return mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)


class Role(StrEnum):
    MASTER = "MASTER"
    SUPERVISOR = "SUPERVISOR"
    STUDENT = "STUDENT"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('MASTER', 'SUPERVISOR', 'STUDENT')",
            name="ck_users_role",
        ),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id: Mapped[UUID] = uuid_column()
    email: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AcademicTerm(Base):
    __tablename__ = 'academic_terms'
    __table_args__ = (
        CheckConstraint('ends_on > starts_on', name='ck_academic_terms_dates'),
        CheckConstraint(
            'status IN (\'DRAFT\', \'ACTIVE\', \'CLOSED\')',
            name='ck_academic_terms_status',
        ),
        UniqueConstraint('name', name='uq_academic_terms_name'),
        Index(
            'uq_academic_terms_active',
            'status',
            unique=True,
            postgresql_where=text('status = \'ACTIVE\''),
        ),
    )

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default=TermStatus.DRAFT.value, server_default='DRAFT'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Course(Base):
    __tablename__ = 'courses'
    __table_args__ = (UniqueConstraint('code', name='uq_courses_code'),)

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Discipline(Base):
    __tablename__ = 'disciplines'
    __table_args__ = (
        CheckConstraint(
            'kind IN (\'DISCIPLINE\', \'INTERNSHIP\')',
            name='ck_disciplines_kind',
        ),
        UniqueConstraint('code', name='uq_disciplines_code'),
    )

    id: Mapped[UUID] = uuid_column()
    course_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('courses.id', ondelete='RESTRICT'),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Cohort(Base):
    __tablename__ = 'cohorts'
    __table_args__ = (
        CheckConstraint('period > 0', name='ck_cohorts_period_positive'),
        UniqueConstraint(
            'term_id',
            'course_id',
            'period',
            'label',
            name='uq_cohorts_term_course_period_label',
        ),
    )

    id: Mapped[UUID] = uuid_column()
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    course_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('courses.id', ondelete='RESTRICT'),
        nullable=False,
    )
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClassBlock(Base):
    __tablename__ = 'class_blocks'
    __table_args__ = (
        CheckConstraint('weekday BETWEEN 0 AND 6', name='ck_class_blocks_weekday'),
        CheckConstraint('start_time < end_time', name='ck_class_blocks_interval'),
        CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'', name='ck_class_blocks_time_zone'
        ),
    )

    id: Mapped[UUID] = uuid_column()
    cohort_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('cohorts.id', ondelete='RESTRICT'),
        nullable=False,
    )
    discipline_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('disciplines.id', ondelete='RESTRICT'),
        nullable=True,
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    time_zone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=INSTITUTIONAL_TIME_ZONE,
        server_default=INSTITUTIONAL_TIME_ZONE,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Student(Base):
    __tablename__ = 'students'

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('users.id', ondelete='RESTRICT'),
        primary_key=True,
    )
    registration: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Supervisor(Base):
    __tablename__ = 'supervisors'
    __table_args__ = (
        CheckConstraint(
            'kind IN (\'PROFESSOR\', \'PRECEPTOR\')',
            name='ck_supervisors_kind',
        ),
        CheckConstraint(
            'max_students_default > 0', name='ck_supervisors_limit_positive'
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('users.id', ondelete='RESTRICT'),
        primary_key=True,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    professional_area: Mapped[str] = mapped_column(Text, nullable=False)
    max_students_default: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class StudentAcademicLink(Base):
    __tablename__ = 'student_academic_links'
    __table_args__ = (
        UniqueConstraint(
            'student_id',
            'term_id',
            'cohort_id',
            'discipline_id',
            name='uq_student_academic_links_context',
        ),
        Index('ix_student_academic_links_student', 'student_id'),
        Index('ix_student_academic_links_term', 'term_id'),
    )

    id: Mapped[UUID] = uuid_column()
    student_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('students.user_id', ondelete='RESTRICT'),
        nullable=False,
    )
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    cohort_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('cohorts.id', ondelete='RESTRICT'),
        nullable=False,
    )
    discipline_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('disciplines.id', ondelete='RESTRICT'),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class StudentAvailability(Base):
    __tablename__ = 'student_availabilities'
    __table_args__ = (
        CheckConstraint(
            'weekday BETWEEN 0 AND 6', name='ck_student_availabilities_weekday'
        ),
        CheckConstraint(
            'start_time < end_time', name='ck_student_availabilities_interval'
        ),
        CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'',
            name='ck_student_availabilities_time_zone',
        ),
        Index('ix_student_availabilities_lookup', 'student_id', 'term_id'),
    )

    id: Mapped[UUID] = uuid_column()
    student_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('students.user_id', ondelete='RESTRICT'),
        nullable=False,
    )
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    time_zone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=INSTITUTIONAL_TIME_ZONE,
        server_default=INSTITUTIONAL_TIME_ZONE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SupervisorAvailability(Base):
    __tablename__ = 'supervisor_availabilities'
    __table_args__ = (
        CheckConstraint(
            'weekday BETWEEN 0 AND 6', name='ck_supervisor_availabilities_weekday'
        ),
        CheckConstraint(
            'start_time < end_time', name='ck_supervisor_availabilities_interval'
        ),
        CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'',
            name='ck_supervisor_availabilities_time_zone',
        ),
        Index('ix_supervisor_availabilities_lookup', 'supervisor_id', 'term_id'),
    )

    id: Mapped[UUID] = uuid_column()
    supervisor_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('supervisors.user_id', ondelete='RESTRICT'),
        nullable=False,
    )
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    time_zone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=INSTITUTIONAL_TIME_ZONE,
        server_default=INSTITUTIONAL_TIME_ZONE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Clinic(Base):
    __tablename__ = 'clinics'
    __table_args__ = (UniqueConstraint('name', name='uq_clinics_name'),)

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    address_label: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Environment(Base):
    __tablename__ = 'environments'
    __table_args__ = (
        UniqueConstraint('clinic_id', 'name', name='uq_environments_clinic_name'),
        Index('ix_environments_clinic', 'clinic_id'),
    )

    id: Mapped[UUID] = uuid_column()
    clinic_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('clinics.id', ondelete='RESTRICT'),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Room(Base):
    __tablename__ = 'rooms'
    __table_args__ = (
        UniqueConstraint(
            'environment_id', 'name', name='uq_rooms_environment_name'
        ),
        Index('ix_rooms_environment', 'environment_id'),
    )

    id: Mapped[UUID] = uuid_column()
    environment_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('environments.id', ondelete='RESTRICT'),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class EquipmentType(Base):
    __tablename__ = 'equipment_types'
    __table_args__ = (UniqueConstraint('name', name='uq_equipment_types_name'),)

    id: Mapped[UUID] = uuid_column()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class EnvironmentEquipment(Base):
    __tablename__ = 'environment_equipments'
    __table_args__ = (
        CheckConstraint('quantity >= 0', name='ck_environment_equipments_quantity'),
        UniqueConstraint(
            'environment_id',
            'equipment_type_id',
            name='uq_environment_equipments_pair',
        ),
        Index('ix_environment_equipments_environment', 'environment_id'),
        Index('ix_environment_equipments_type', 'equipment_type_id'),
    )

    id: Mapped[UUID] = uuid_column()
    environment_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('environments.id', ondelete='RESTRICT'),
        nullable=False,
    )
    equipment_type_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('equipment_types.id', ondelete='RESTRICT'),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicTermConfig(Base):
    __tablename__ = 'clinic_term_configs'
    __table_args__ = (
        CheckConstraint(
            'max_simultaneous_appointments > 0',
            name='ck_clinic_term_configs_appointments_positive',
        ),
        CheckConstraint(
            'max_students > 0', name='ck_clinic_term_configs_students_positive'
        ),
        UniqueConstraint(
            'clinic_id', 'term_id', name='uq_clinic_term_configs_clinic_term'
        ),
        Index('ix_clinic_term_configs_clinic', 'clinic_id'),
        Index('ix_clinic_term_configs_term', 'term_id'),
    )

    id: Mapped[UUID] = uuid_column()
    clinic_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('clinics.id', ondelete='RESTRICT'),
        nullable=False,
    )
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    max_simultaneous_appointments: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    max_students: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicalService(Base):
    __tablename__ = 'services'
    __table_args__ = (
        CheckConstraint(
            'duration_minutes > 0', name='ck_services_duration_positive'
        ),
        UniqueConstraint(
            'discipline_id', 'name', name='uq_services_discipline_name'
        ),
        Index('ix_services_discipline', 'discipline_id'),
    )

    id: Mapped[UUID] = uuid_column()
    discipline_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('disciplines.id', ondelete='RESTRICT'),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ServiceEquipmentRequirement(Base):
    __tablename__ = 'service_equipment_requirements'
    __table_args__ = (
        CheckConstraint(
            'units_per_appointment > 0',
            name='ck_service_equipment_requirements_units_positive',
        ),
        UniqueConstraint(
            'service_id',
            'equipment_type_id',
            name='uq_service_equipment_requirements_pair',
        ),
        Index('ix_service_equipment_requirements_service', 'service_id'),
        Index('ix_service_equipment_requirements_type', 'equipment_type_id'),
    )

    id: Mapped[UUID] = uuid_column()
    service_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('services.id', ondelete='RESTRICT'),
        nullable=False,
    )
    equipment_type_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('equipment_types.id', ondelete='RESTRICT'),
        nullable=False,
    )
    units_per_appointment: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SupervisorServiceScope(Base):
    __tablename__ = 'supervisor_service_scopes'
    __table_args__ = (
        CheckConstraint(
            'max_students_override IS NULL OR max_students_override > 0',
            name='ck_supervisor_service_scopes_override_positive',
        ),
        UniqueConstraint(
            'supervisor_id',
            'term_id',
            'service_id',
            'environment_id',
            name='uq_supervisor_service_scopes_context',
        ),
        Index('ix_supervisor_service_scopes_supervisor', 'supervisor_id'),
        Index('ix_supervisor_service_scopes_term', 'term_id'),
        Index('ix_supervisor_service_scopes_service', 'service_id'),
        Index('ix_supervisor_service_scopes_environment', 'environment_id'),
    )

    id: Mapped[UUID] = uuid_column()
    supervisor_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('supervisors.user_id', ondelete='RESTRICT'),
        nullable=False,
    )
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    service_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('services.id', ondelete='RESTRICT'),
        nullable=False,
    )
    environment_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('environments.id', ondelete='RESTRICT'),
        nullable=False,
    )
    can_review_documents: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default='false'
    )
    max_students_override: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class DocumentSubmissionStatus(StrEnum):
    PENDING_REVIEW = 'PENDING_REVIEW'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    EXPIRED = 'EXPIRED'


class DocumentRequirement(Base):
    __tablename__ = 'document_requirements'
    __table_args__ = (
        UniqueConstraint(
            'term_id',
            'discipline_id',
            'name',
            name='uq_document_requirements_context_name',
        ),
        Index(
            'uq_document_requirements_global_name',
            'term_id',
            'name',
            unique=True,
            postgresql_where=text('discipline_id IS NULL'),
        ),
        Index('ix_document_requirements_term', 'term_id'),
        Index('ix_document_requirements_discipline', 'discipline_id'),
    )

    id: Mapped[UUID] = uuid_column()
    term_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('academic_terms.id', ondelete='RESTRICT'),
        nullable=False,
    )
    discipline_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('disciplines.id', ondelete='RESTRICT'),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    expires_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default='false'
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default='true'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class DocumentSubmission(Base):
    __tablename__ = 'document_submissions'
    __table_args__ = (
        CheckConstraint(
            'status IN (\'PENDING_REVIEW\', \'APPROVED\', \'REJECTED\', \'EXPIRED\')',
            name='ck_document_submissions_status',
        ),
        CheckConstraint(
            'size_bytes > 0 AND size_bytes <= 10485760',
            name='ck_document_submissions_size',
        ),
        CheckConstraint(
            'status <> \'REJECTED\' OR (review_note IS NOT NULL AND '
            'length(trim(review_note)) > 0)',
            name='ck_document_submissions_rejection_note',
        ),
        Index(
            'ix_document_submissions_requirement_status',
            'requirement_id',
            'status',
        ),
        Index(
            'ix_document_submissions_student_requirement',
            'student_id',
            'requirement_id',
        ),
        Index('ix_document_submissions_review_queue', 'status', 'created_at'),
    )

    id: Mapped[UUID] = uuid_column()
    requirement_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('document_requirements.id', ondelete='RESTRICT'),
        nullable=False,
    )
    student_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('students.user_id', ondelete='RESTRICT'),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    original_name: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=DocumentSubmissionStatus.PENDING_REVIEW.value,
        server_default=DocumentSubmissionStatus.PENDING_REVIEW.value,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('users.id', ondelete='RESTRICT'),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AuditEvent(Base):
    __tablename__ = 'audit_events'
    __table_args__ = (
        Index('ix_audit_events_target', 'target_type', 'target_id'),
        Index('ix_audit_events_actor', 'actor_user_id', 'occurred_at'),
        Index('ix_audit_events_occurred_at', 'occurred_at'),
    )

    id: Mapped[UUID] = uuid_column()
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey('users.id', ondelete='RESTRICT'),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    target_type: Mapped[str] = mapped_column(Text, nullable=False)
    target_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict, server_default=text('{}')
    )
