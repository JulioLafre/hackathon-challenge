from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Executable

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    Appointment,
    AppointmentRiskStatus,
    AppointmentSlot,
    AppointmentStatus,
    AuditEvent,
    Clinic,
    ClinicalService,
    ClinicalSession,
    ClinicalSessionStatus,
    DocumentRequirement,
    DocumentSubmission,
    DocumentSubmissionStatus,
    Role,
    SessionAllocation,
    SessionAllocationStatus,
    User,
)
from app.modules.admin.schemas import (
    AdminDashboardRead,
    AtRiskAppointmentListRead,
    AtRiskAppointmentRead,
    AuditEventListRead,
    AuditEventRead,
    DashboardCounts,
    UpcomingSessionRead,
)
from app.modules.auth.dependencies import get_db_session, require_roles
from app.modules.auth.schemas import UserProfile

router = APIRouter(tags=['admin'])
MasterUser = Annotated[User, Depends(require_roles(Role.MASTER))]
ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.BOOKED.value,
    AppointmentStatus.CONFIRMED.value,
]


async def _count(session: AsyncSession, query: Executable) -> int:
    return int((await session.scalar(query)) or 0)


@router.get('/admin/dashboard', response_model=AdminDashboardRead)
async def get_dashboard(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    term_id: UUID | None = None,
) -> AdminDashboardRead:
    term = (
        await session.get(AcademicTerm, term_id)
        if term_id is not None
        else await session.scalar(
            select(AcademicTerm)
            .where(AcademicTerm.status == 'ACTIVE')
            .order_by(AcademicTerm.starts_on)
        )
    )
    if term_id is not None and term is None:
        raise ApiError(404, 'NOT_FOUND', 'Semestre nao encontrado.')
    if term is None:
        return AdminDashboardRead(
            term_id=None,
            counts=DashboardCounts(
                pending_documents=0,
                sessions_total=0,
                published_sessions=0,
                active_allocations=0,
                active_appointments=0,
                at_risk_appointments=0,
            ),
            upcoming_sessions=[],
            alerts=[],
        )

    pending_documents = await _count(
        session,
        select(func.count())
        .select_from(DocumentSubmission)
        .join(
            DocumentRequirement,
            DocumentRequirement.id == DocumentSubmission.requirement_id,
        )
        .where(
            DocumentRequirement.term_id == term.id,
            DocumentSubmission.status == DocumentSubmissionStatus.PENDING_REVIEW.value,
        ),
    )
    sessions_total = await _count(
        session,
        select(func.count())
        .select_from(ClinicalSession)
        .where(ClinicalSession.term_id == term.id),
    )
    published_sessions = await _count(
        session,
        select(func.count())
        .select_from(ClinicalSession)
        .where(
            ClinicalSession.term_id == term.id,
            ClinicalSession.status == ClinicalSessionStatus.PUBLISHED.value,
        ),
    )
    active_allocations = await _count(
        session,
        select(func.count())
        .select_from(SessionAllocation)
        .join(
            ClinicalSession,
            ClinicalSession.id == SessionAllocation.session_id,
        )
        .where(
            ClinicalSession.term_id == term.id,
            SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
        ),
    )
    active_appointments = await _count(
        session,
        select(func.count())
        .select_from(Appointment)
        .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
        .join(ClinicalSession, ClinicalSession.id == AppointmentSlot.session_id)
        .where(
            ClinicalSession.term_id == term.id,
            Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
        ),
    )
    at_risk_appointments = await _count(
        session,
        select(func.count())
        .select_from(Appointment)
        .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
        .join(ClinicalSession, ClinicalSession.id == AppointmentSlot.session_id)
        .where(
            ClinicalSession.term_id == term.id,
            Appointment.risk_status == 'AT_RISK',
            Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
        ),
    )

    now = datetime.now(UTC)
    session_rows = (
        await session.execute(
            select(ClinicalSession, ClinicalService.name, Clinic.name)
            .join(ClinicalService, ClinicalService.id == ClinicalSession.service_id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .where(
                ClinicalSession.term_id == term.id,
                ClinicalSession.status == ClinicalSessionStatus.PUBLISHED.value,
                ClinicalSession.starts_at > now,
            )
            .order_by(ClinicalSession.starts_at, ClinicalSession.id)
            .limit(10)
        )
    ).all()
    upcoming: list[UpcomingSessionRead] = []
    for clinical_session, service_name, clinic_name in session_rows:
        available = await session.scalar(
            select(
                func.coalesce(
                    func.sum(
                        AppointmentSlot.capacity_total
                        - AppointmentSlot.reserved_count
                    ),
                    0,
                )
            ).where(AppointmentSlot.session_id == clinical_session.id)
        )
        explanation = clinical_session.capacity_explanation or {}
        capacity_effective = explanation.get('effective', 0)
        capacity_effective = (
            int(capacity_effective)
            if isinstance(capacity_effective, int | float)
            else 0
        )
        upcoming.append(
            UpcomingSessionRead(
                id=clinical_session.id,
                starts_at=clinical_session.starts_at,
                ends_at=clinical_session.ends_at,
                status=clinical_session.status,
                service_name=service_name,
                clinic_name=clinic_name,
                capacity_effective=capacity_effective,
                capacity_available=max(0, int(available or 0)),
            )
        )

    alerts: list[str] = []
    if pending_documents:
        alerts.append('DOCUMENTS_PENDING')
    if at_risk_appointments:
        alerts.append('APPOINTMENTS_AT_RISK')
    return AdminDashboardRead(
        term_id=term.id,
        counts=DashboardCounts(
            pending_documents=pending_documents,
            sessions_total=sessions_total,
            published_sessions=published_sessions,
            active_allocations=active_allocations,
            active_appointments=active_appointments,
            at_risk_appointments=at_risk_appointments,
        ),
        upcoming_sessions=upcoming,
        alerts=alerts,
    )


@router.get('/users', response_model=list[UserProfile])
async def list_users(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[User]:
    result = await session.scalars(select(User).order_by(User.email))
    return list(result)


@router.post('/users/{user_id}/deactivate', response_model=UserProfile)
async def deactivate_user(
    user_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: MasterUser,
) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(404, 'NOT_FOUND', 'Usuario nao encontrado.')
    if user.id == current_user.id:
        raise ApiError(
            409,
            'SELF_DEACTIVATION_FORBIDDEN',
            'O Master atual nao pode desativar o proprio acesso.',
        )
    if user.is_active:
        user.is_active = False
        session.add(
            AuditEvent(
                actor_user_id=current_user.id,
                action='USER_DEACTIVATED',
                target_type='user',
                target_id=user.id,
                metadata_json={
                    'role': user.role,
                    'is_active': False,
                },
            )
        )
        await session.commit()
        await session.refresh(user)
    return user


@router.post('/users/{user_id}/activate', response_model=UserProfile)
async def activate_user(
    user_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: MasterUser,
) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(404, 'NOT_FOUND', 'Usuario nao encontrado.')
    if not user.is_active:
        user.is_active = True
        session.add(
            AuditEvent(
                actor_user_id=current_user.id,
                action='USER_ACTIVATED',
                target_type='user',
                target_id=user.id,
                metadata_json={
                    'role': user.role,
                    'is_active': True,
                },
            )
        )
        await session.commit()
        await session.refresh(user)
    return user


@router.get(
    '/admin/appointments/at-risk',
    response_model=AtRiskAppointmentListRead,
)
async def list_at_risk_appointments(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    term_id: UUID | None = None,
    page: Annotated[int, Query(ge=1, le=10000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AtRiskAppointmentListRead:
    if term_id is not None and await session.get(AcademicTerm, term_id) is None:
        raise ApiError(404, 'NOT_FOUND', 'Semestre nao encontrado.')
    filters = [
        Appointment.risk_status == AppointmentRiskStatus.AT_RISK.value,
        Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
    ]
    if term_id is not None:
        filters.append(ClinicalSession.term_id == term_id)
    total = await _count(
        session,
        select(func.count())
        .select_from(Appointment)
        .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
        .join(ClinicalSession, ClinicalSession.id == AppointmentSlot.session_id)
        .where(*filters),
    )
    rows = (
        await session.execute(
            select(
                Appointment,
                AppointmentSlot,
                ClinicalSession,
                ClinicalService.name,
                Clinic.name,
                SessionAllocation.suspended_reason,
            )
            .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
            .join(
                ClinicalSession,
                ClinicalSession.id == AppointmentSlot.session_id,
            )
            .join(ClinicalService, ClinicalService.id == ClinicalSession.service_id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .join(
                SessionAllocation,
                SessionAllocation.id == Appointment.allocation_id,
            )
            .where(*filters)
            .order_by(AppointmentSlot.starts_at, Appointment.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return AtRiskAppointmentListRead(
        items=[
            AtRiskAppointmentRead(
                id=appointment.id,
                session_id=clinical_session.id,
                slot_id=slot.id,
                starts_at=slot.starts_at,
                ends_at=slot.ends_at,
                service_name=service_name,
                clinic_name=clinic_name,
                risk_status=appointment.risk_status,
                cause=suspended_reason or 'CAPACITY_CHANGED',
            )
            for (
                appointment,
                slot,
                clinical_session,
                service_name,
                clinic_name,
                suspended_reason,
            ) in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get('/audit-events', response_model=AuditEventListRead)
async def list_audit_events(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
    actor_user_id: UUID | None = None,
    action: str | None = None,
    target_type: str | None = None,
    from_at: Annotated[datetime | None, Query(alias='from')] = None,
    to_at: Annotated[datetime | None, Query(alias='to')] = None,
    page: Annotated[int, Query(ge=1, le=10000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AuditEventListRead:
    filters = []
    if actor_user_id is not None:
        filters.append(AuditEvent.actor_user_id == actor_user_id)
    if action is not None:
        filters.append(AuditEvent.action == action)
    if target_type is not None:
        filters.append(AuditEvent.target_type == target_type)
    if from_at is not None:
        filters.append(AuditEvent.occurred_at >= from_at)
    if to_at is not None:
        filters.append(AuditEvent.occurred_at < to_at)
    total = await _count(
        session,
        select(func.count()).select_from(AuditEvent).where(*filters),
    )
    events = list(
        await session.scalars(
            select(AuditEvent)
            .where(*filters)
            .order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return AuditEventListRead(
        items=[
            AuditEventRead(
                id=event.id,
                actor_user_id=event.actor_user_id,
                action=event.action,
                target_type=event.target_type,
                target_id=event.target_id,
                occurred_at=event.occurred_at,
                metadata_json=event.metadata_json,
            )
            for event in events
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
