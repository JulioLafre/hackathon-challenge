from datetime import date, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db.models import (
    DisciplineKind,
    SupervisorKind,
    TermStatus,
)

INSTITUTIONAL_TIME_ZONE = 'America/Sao_Paulo'


class TermCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    starts_on: date
    ends_on: date

    @model_validator(mode='after')
    def validate_dates(self) -> 'TermCreate':
        if self.ends_on <= self.starts_on:
            raise ValueError('ends_on must be after starts_on')
        return self


class TermUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    starts_on: date
    ends_on: date

    @model_validator(mode='after')
    def validate_dates(self) -> 'TermUpdate':
        if self.ends_on <= self.starts_on:
            raise ValueError('ends_on must be after starts_on')
        return self


class TermRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    starts_on: date
    ends_on: date
    status: TermStatus


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=40)


class CourseUpdate(CourseCreate):
    pass


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    is_active: bool


class DisciplineCreate(BaseModel):
    course_id: UUID
    name: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=40)
    kind: DisciplineKind


class DisciplineUpdate(DisciplineCreate):
    pass


class DisciplineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    name: str
    code: str
    kind: DisciplineKind
    is_active: bool


class CohortCreate(BaseModel):
    term_id: UUID
    course_id: UUID
    period: int = Field(gt=0, le=20)
    label: str = Field(min_length=1, max_length=120)


class CohortUpdate(CohortCreate):
    pass


class CohortRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    course_id: UUID
    period: int
    label: str
    is_active: bool


class IntervalPayload(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    time_zone: str = INSTITUTIONAL_TIME_ZONE

    @model_validator(mode='after')
    def validate_interval(self) -> 'IntervalPayload':
        if self.time_zone != INSTITUTIONAL_TIME_ZONE:
            raise ValueError(
                f'time_zone must be {INSTITUTIONAL_TIME_ZONE}'
            )
        if self.end_time <= self.start_time:
            raise ValueError('end_time must be after start_time')
        return self


class ClassBlockCreate(IntervalPayload):
    cohort_id: UUID
    discipline_id: UUID | None = None


class ClassBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cohort_id: UUID
    discipline_id: UUID | None
    weekday: int
    start_time: time
    end_time: time
    time_zone: str
    is_active: bool


class StudentCreate(BaseModel):
    user_id: UUID
    registration: str = Field(min_length=1, max_length=80)
    full_name: str = Field(min_length=1, max_length=180)
    phone: str | None = Field(default=None, max_length=30)


class StudentProfileUpdate(BaseModel):
    registration: str = Field(min_length=1, max_length=80)
    full_name: str = Field(min_length=1, max_length=180)
    phone: str | None = Field(default=None, max_length=30)


class StudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    registration: str
    full_name: str
    phone: str | None


class SupervisorCreate(BaseModel):
    user_id: UUID
    kind: SupervisorKind
    full_name: str = Field(min_length=1, max_length=180)
    professional_area: str = Field(min_length=1, max_length=160)
    max_students_default: int = Field(gt=0, le=100)


class SupervisorRead(BaseModel):
    user_id: UUID
    kind: SupervisorKind
    full_name: str
    professional_area: str
    max_students_default: int


class StudentAcademicLinkCreate(BaseModel):
    student_id: UUID
    term_id: UUID
    cohort_id: UUID
    discipline_id: UUID


class StudentAcademicLinkRead(BaseModel):
    id: UUID
    student_id: UUID
    term_id: UUID
    term_status: TermStatus
    cohort_id: UUID
    discipline_id: UUID


class AvailabilityUpdate(BaseModel):
    term_id: UUID
    intervals: list[IntervalPayload]


class ManagedAvailabilityUpdate(AvailabilityUpdate):
    user_id: UUID
    owner_type: Literal['STUDENT', 'SUPERVISOR']


class AvailabilityRead(BaseModel):
    owner_type: str
    term_id: UUID
    time_zone: str
    intervals: list[IntervalPayload]
