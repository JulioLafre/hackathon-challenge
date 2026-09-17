from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardCounts(BaseModel):
    pending_documents: int
    sessions_total: int
    published_sessions: int
    active_allocations: int
    active_appointments: int
    at_risk_appointments: int


class UpcomingSessionRead(BaseModel):
    id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    service_name: str
    clinic_name: str
    capacity_effective: int
    capacity_available: int


class AdminDashboardRead(BaseModel):
    term_id: UUID | None
    counts: DashboardCounts
    upcoming_sessions: list[UpcomingSessionRead]
    alerts: list[str]


class AuditEventRead(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    action: str
    target_type: str
    target_id: UUID
    occurred_at: datetime
    metadata_json: dict[str, object]


class AuditEventListRead(BaseModel):
    items: list[AuditEventRead]
    total: int
    page: int
    page_size: int


class AtRiskAppointmentRead(BaseModel):
    id: UUID
    session_id: UUID
    slot_id: UUID
    starts_at: datetime
    ends_at: datetime
    service_name: str
    clinic_name: str
    risk_status: str
    cause: str


class AtRiskAppointmentListRead(BaseModel):
    items: list[AtRiskAppointmentRead]
    total: int
    page: int
    page_size: int
