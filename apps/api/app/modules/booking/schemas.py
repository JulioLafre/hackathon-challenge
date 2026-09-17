from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


class PublicServiceRead(BaseModel):
    id: UUID
    name: str
    duration_minutes: int


class PublicSlotRead(BaseModel):
    id: UUID
    service_id: UUID
    service_name: str
    clinic_id: UUID
    clinic_name: str
    starts_at: datetime
    ends_at: datetime
    capacity_available: int


class PublicAppointmentCreate(BaseModel):
    slot_id: UUID
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=8, max_length=32)
    privacy_notice_version: str = Field(min_length=1, max_length=32)

    @model_validator(mode='after')
    def require_contact(self) -> 'PublicAppointmentCreate':
        if self.email is None and not self.phone:
            raise ValueError('Informe e-mail ou telefone.')
        return self


class PublicAppointmentRead(BaseModel):
    id: UUID
    status: str
    risk_status: str
    service_id: UUID
    service_name: str
    clinic_id: UUID
    clinic_name: str
    starts_at: datetime
    ends_at: datetime
    management_code: str | None = None


class AppointmentManagementRequest(BaseModel):
    appointment_id: UUID
    management_code: str = Field(min_length=16, max_length=256)


class PublicRateLimitResponse(BaseModel):
    detail: str
