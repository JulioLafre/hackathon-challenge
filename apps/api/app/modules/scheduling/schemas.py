from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('datetime must include a timezone offset')
    return value


class SessionCreate(BaseModel):
    term_id: UUID
    service_id: UUID
    clinic_id: UUID
    environment_id: UUID
    supervisor_id: UUID
    starts_at: datetime
    ends_at: datetime
    max_students_override: int | None = Field(default=None, gt=0, le=10000)

    @model_validator(mode='after')
    def validate_interval(self) -> 'SessionCreate':
        ensure_aware(self.starts_at)
        ensure_aware(self.ends_at)
        if self.ends_at <= self.starts_at:
            raise ValueError('ends_at must be after starts_at')
        return self


class SessionUpdate(BaseModel):
    term_id: UUID | None = None
    service_id: UUID | None = None
    clinic_id: UUID | None = None
    environment_id: UUID | None = None
    supervisor_id: UUID | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_students_override: int | None = Field(default=None, gt=0, le=10000)

    @model_validator(mode='after')
    def validate_datetimes(self) -> 'SessionUpdate':
        if self.starts_at is not None:
            ensure_aware(self.starts_at)
        if self.ends_at is not None:
            ensure_aware(self.ends_at)
        if self.starts_at is not None and self.ends_at is not None:
            if self.ends_at <= self.starts_at:
                raise ValueError('ends_at must be after starts_at')
        return self


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    service_id: UUID
    clinic_id: UUID
    environment_id: UUID
    supervisor_id: UUID
    starts_at: datetime
    ends_at: datetime
    max_students_override: int | None
    status: str
    capacity_explanation: dict[str, object] | None


class SupervisorSessionOptionRead(BaseModel):
    id: UUID
    supervisor_id: UUID
    term_id: UUID
    term_name: str
    term_status: str
    term_starts_on: date
    term_ends_on: date
    service_id: UUID
    service_name: str
    duration_minutes: int
    clinic_id: UUID
    clinic_name: str
    environment_id: UUID
    environment_name: str
    max_students_default: int
    max_students_override: int | None


class StudentSessionRead(BaseModel):
    id: UUID
    term_id: UUID
    term_name: str
    service_id: UUID
    service_name: str
    clinic_id: UUID
    clinic_name: str
    environment_id: UUID
    environment_name: str
    supervisor_id: UUID
    supervisor_name: str
    starts_at: datetime
    ends_at: datetime
    status: str
    allocation_id: UUID | None
    allocation_status: str | None
    can_join: bool
    blocked_code: str | None
    blocked_message: str | None


class SessionPublishRead(SessionRead):
    slots_created: int


class SessionCancelRead(SessionRead):
    pass


class SessionAllocationCreate(BaseModel):
    student_id: UUID | None = None


class SessionAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    student_id: UUID
    status: str
    suspended_reason: str | None


class CapacityRead(BaseModel):
    effective: int
    constraints: dict[str, int]
    limiting_factors: list[str]


class AppointmentSlotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    starts_at: datetime
    ends_at: datetime
    capacity_total: int
    reserved_count: int
    version: int
