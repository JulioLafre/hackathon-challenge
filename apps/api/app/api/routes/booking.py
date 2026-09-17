import hashlib
import hmac
import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    Appointment,
    AppointmentEquipmentAllocation,
    AppointmentRiskStatus,
    AppointmentSlot,
    AppointmentStatus,
    AuditEvent,
    Clinic,
    ClinicalService,
    ClinicalSession,
    ClinicalSessionStatus,
    ClinicTermConfig,
    EnvironmentEquipment,
    Room,
    ServiceEquipmentRequirement,
    SessionAllocation,
    SessionAllocationStatus,
)
from app.modules.auth.dependencies import get_db_session
from app.modules.booking.schemas import (
    AppointmentManagementRequest,
    PublicAppointmentCreate,
    PublicAppointmentRead,
    PublicServiceRead,
    PublicSlotRead,
)
from app.modules.scheduling.services import calculate_capacity

router = APIRouter(prefix='/public', tags=['public-booking'])
ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.BOOKED.value,
    AppointmentStatus.CONFIRMED.value,
]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else 'unknown'


def _consume_limit(request: Request, limiter_name: str) -> None:
    limiter = getattr(request.app.state, limiter_name)
    retry_after = limiter.consume(_client_ip(request))
    if retry_after is not None:
        raise ApiError(
            429,
            'PUBLIC_RATE_LIMITED',
            'Muitas tentativas. Tente novamente mais tarde.',
            headers={'Retry-After': str(retry_after)},
        )


def _management_hash(code: str, secret: str) -> str:
    return hmac.new(
        secret.encode('utf-8'),
        code.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


def _valid_management_code(code: str, stored_hash: str, secret: str) -> bool:
    candidate = _management_hash(code, secret)
    return hmac.compare_digest(candidate, stored_hash)


async def _appointment_view(
    session: AsyncSession,
    appointment: Appointment,
    *,
    management_code: str | None = None,
) -> PublicAppointmentRead:
    row = (
        await session.execute(
            select(AppointmentSlot, ClinicalSession, ClinicalService, Clinic)
            .join(
                ClinicalSession,
                ClinicalSession.id == AppointmentSlot.session_id,
            )
            .join(ClinicalService, ClinicalService.id == ClinicalSession.service_id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .where(AppointmentSlot.id == appointment.slot_id)
        )
    ).one_or_none()
    if row is None:
        raise ApiError(404, 'NOT_FOUND', 'Agendamento nao encontrado.')
    slot, clinical_session, service, clinic = row
    return PublicAppointmentRead(
        id=appointment.id,
        status=appointment.status,
        risk_status=appointment.risk_status,
        service_id=service.id,
        service_name=service.name,
        clinic_id=clinic.id,
        clinic_name=clinic.name,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        management_code=management_code,
    )


def _slot_full() -> ApiError:
    return ApiError(
        409,
        'SLOT_FULL',
        'Este horario nao possui capacidade disponivel.',
    )


def _invalid_state(message: str) -> ApiError:
    return ApiError(409, 'INVALID_STATE_TRANSITION', message)


async def _available_allocation(
    session: AsyncSession,
    slot: AppointmentSlot,
) -> SessionAllocation | None:
    allocations = list(
        await session.scalars(
            select(SessionAllocation)
            .where(
                SessionAllocation.session_id == slot.session_id,
                SessionAllocation.status == SessionAllocationStatus.ACTIVE.value,
            )
            .order_by(SessionAllocation.id)
            .with_for_update()
        )
    )
    used_ids = set(
        await session.scalars(
            select(Appointment.allocation_id).where(
                Appointment.slot_id == slot.id,
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            )
        )
    )
    return next(
        (allocation for allocation in allocations if allocation.id not in used_ids),
        None,
    )


async def _lock_and_revalidate_resources(
    session: AsyncSession,
    slot: AppointmentSlot,
    clinical_session: ClinicalSession,
) -> tuple[
    SessionAllocation,
    Room,
    list[tuple[EnvironmentEquipment, int]],
]:
    config = await session.scalar(
        select(ClinicTermConfig)
        .where(
            ClinicTermConfig.clinic_id == clinical_session.clinic_id,
            ClinicTermConfig.term_id == clinical_session.term_id,
        )
        .with_for_update()
    )
    if config is None:
        raise ApiError(422, 'VALIDATION_ERROR', 'Clinica sem configuracao.')

    requirements = list(
        await session.scalars(
            select(ServiceEquipmentRequirement)
            .where(
                ServiceEquipmentRequirement.service_id
                == clinical_session.service_id
            )
            .order_by(ServiceEquipmentRequirement.equipment_type_id)
        )
    )
    inventories: list[tuple[EnvironmentEquipment, int]] = []
    for requirement in requirements:
        inventory = await session.scalar(
            select(EnvironmentEquipment)
            .where(
                EnvironmentEquipment.environment_id
                == clinical_session.environment_id,
                EnvironmentEquipment.equipment_type_id
                == requirement.equipment_type_id,
                EnvironmentEquipment.is_active.is_(True),
            )
            .with_for_update()
        )
        if inventory is None:
            raise _slot_full()
        consumed = await session.scalar(
            select(func.coalesce(func.sum(AppointmentEquipmentAllocation.quantity), 0))
            .join(
                Appointment,
                Appointment.id
                == AppointmentEquipmentAllocation.appointment_id,
            )
            .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
            .join(
                ClinicalSession,
                ClinicalSession.id == AppointmentSlot.session_id,
            )
            .where(
                AppointmentEquipmentAllocation.environment_equipment_id
                == inventory.id,
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
                ClinicalSession.starts_at < clinical_session.ends_at,
                ClinicalSession.ends_at > clinical_session.starts_at,
            )
        )
        quantity = requirement.units_per_appointment
        if int(consumed or 0) + quantity > inventory.quantity:
            raise _slot_full()
        inventories.append((inventory, quantity))

    rooms = list(
        await session.scalars(
            select(Room)
            .where(
                Room.environment_id == clinical_session.environment_id,
                Room.is_active.is_(True),
            )
            .order_by(Room.id)
            .with_for_update()
        )
    )
    occupied_rooms = set(
        await session.scalars(
            select(Appointment.room_id)
            .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
            .join(
                ClinicalSession,
                ClinicalSession.id == AppointmentSlot.session_id,
            )
            .where(
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
                ClinicalSession.environment_id == clinical_session.environment_id,
                AppointmentSlot.starts_at < slot.ends_at,
                AppointmentSlot.ends_at > slot.starts_at,
            )
        )
    )
    room = next((item for item in rooms if item.id not in occupied_rooms), None)
    if room is None:
        raise _slot_full()

    clinic_count = await session.scalar(
        select(func.count())
        .select_from(Appointment)
        .join(AppointmentSlot, AppointmentSlot.id == Appointment.slot_id)
        .join(ClinicalSession, ClinicalSession.id == AppointmentSlot.session_id)
        .where(
            Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            ClinicalSession.clinic_id == clinical_session.clinic_id,
            AppointmentSlot.starts_at < slot.ends_at,
            AppointmentSlot.ends_at > slot.starts_at,
        )
    )
    if int(clinic_count or 0) >= config.max_simultaneous_appointments:
        raise _slot_full()

    allocation = await _available_allocation(session, slot)
    if allocation is None:
        raise _slot_full()
    capacity = await calculate_capacity(session, clinical_session)
    allowed = min(slot.capacity_total, capacity.effective)
    if slot.reserved_count >= allowed:
        raise _slot_full()
    return allocation, room, inventories


@router.post(
    '/appointments',
    response_model=PublicAppointmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_appointment(
    payload: PublicAppointmentCreate,
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    idempotency_key: Annotated[
        str | None, Header(alias='Idempotency-Key')
    ] = None,
) -> PublicAppointmentRead:
    _consume_limit(request, 'public_create_rate_limiter')
    if idempotency_key is None or not idempotency_key.strip():
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'Idempotency-Key e obrigatoria.',
        )
    idempotency_key = idempotency_key.strip()
    if len(idempotency_key) > 160:
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'Idempotency-Key excede o limite permitido.',
        )
    existing = await session.scalar(
        select(Appointment).where(
            Appointment.idempotency_key == idempotency_key
        )
    )
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return await _appointment_view(session, existing)

    if (
        payload.privacy_notice_version
        != request.app.state.settings.privacy_notice_version
    ):
        raise ApiError(
            422,
            'PRIVACY_NOTICE_VERSION_REQUIRED',
            'Aceite a versao atual do aviso de privacidade.',
        )
    public_name = payload.name.strip()
    if len(public_name) < 2:
        raise ApiError(422, 'VALIDATION_ERROR', 'Nome invalido.')
    slot = await session.scalar(
        select(AppointmentSlot)
        .where(AppointmentSlot.id == payload.slot_id)
        .with_for_update()
    )
    if slot is None:
        raise ApiError(404, 'NOT_FOUND', 'Horario nao encontrado.')
    clinical_session = await session.get(ClinicalSession, slot.session_id)
    if clinical_session is None:
        raise ApiError(404, 'NOT_FOUND', 'Horario nao encontrado.')
    if clinical_session.status != ClinicalSessionStatus.PUBLISHED.value:
        raise _invalid_state('O horario nao esta publicado.')
    if slot.starts_at <= datetime.now(UTC):
        raise _invalid_state('O horario ja iniciou.')
    if slot.reserved_count >= slot.capacity_total:
        raise _slot_full()

    allocation, room, inventories = await _lock_and_revalidate_resources(
        session,
        slot,
        clinical_session,
    )
    management_code = secrets.token_urlsafe(32)
    appointment = Appointment(
        slot_id=slot.id,
        allocation_id=allocation.id,
        room_id=room.id,
        public_name=public_name,
        public_email=str(payload.email).lower() if payload.email else None,
        public_phone=payload.phone.strip() if payload.phone else None,
        privacy_notice_version=payload.privacy_notice_version,
        status=AppointmentStatus.BOOKED.value,
        risk_status=AppointmentRiskStatus.NONE.value,
        management_token_hash=_management_hash(
            management_code,
            request.app.state.settings.jwt_secret_key,
        ),
        idempotency_key=idempotency_key,
    )
    session.add(appointment)
    await session.flush()
    for inventory, quantity in inventories:
        session.add(
            AppointmentEquipmentAllocation(
                appointment_id=appointment.id,
                environment_equipment_id=inventory.id,
                quantity=quantity,
            )
        )
    slot.reserved_count += 1
    slot.version += 1
    session.add(
        AuditEvent(
            actor_user_id=None,
            action='APPOINTMENT_CREATED',
            target_type='appointment',
            target_id=appointment.id,
            metadata_json={'status': appointment.status},
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(Appointment).where(
                Appointment.idempotency_key == idempotency_key
            )
        )
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return await _appointment_view(session, existing)
        raise _slot_full() from None
    await session.refresh(appointment)
    return await _appointment_view(
        session,
        appointment,
        management_code=management_code,
    )


async def _load_for_management(
    session: AsyncSession,
    payload: AppointmentManagementRequest,
    request: Request,
) -> tuple[Appointment, AppointmentSlot]:
    appointment = await session.scalar(
        select(Appointment)
        .where(Appointment.id == payload.appointment_id)
        .with_for_update()
    )
    if appointment is None or not _valid_management_code(
        payload.management_code,
        appointment.management_token_hash if appointment else '',
        request.app.state.settings.jwt_secret_key,
    ):
        raise ApiError(
            404,
            'INVALID_MANAGEMENT_CODE',
            'Nao foi possivel validar o codigo informado.',
        )
    slot = await session.get(AppointmentSlot, appointment.slot_id)
    if slot is None:
        raise ApiError(404, 'NOT_FOUND', 'Agendamento nao encontrado.')
    if slot.starts_at <= datetime.now(UTC):
        raise _invalid_state('O horario ja iniciou.')
    return appointment, slot


@router.post(
    '/appointments/confirm',
    response_model=PublicAppointmentRead,
)
async def confirm_public_appointment(
    payload: AppointmentManagementRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> PublicAppointmentRead:
    _consume_limit(request, 'public_management_rate_limiter')
    appointment, _ = await _load_for_management(session, payload, request)
    if appointment.status != AppointmentStatus.BOOKED.value:
        raise _invalid_state('Somente uma reserva pendente pode ser confirmada.')
    appointment.status = AppointmentStatus.CONFIRMED.value
    appointment.confirmed_at = datetime.now(UTC)
    session.add(
        AuditEvent(
            actor_user_id=None,
            action='APPOINTMENT_CONFIRMED',
            target_type='appointment',
            target_id=appointment.id,
            metadata_json={'status': appointment.status},
        )
    )
    await session.commit()
    await session.refresh(appointment)
    return await _appointment_view(session, appointment)


@router.post(
    '/appointments/cancel',
    response_model=PublicAppointmentRead,
)
async def cancel_public_appointment(
    payload: AppointmentManagementRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> PublicAppointmentRead:
    _consume_limit(request, 'public_management_rate_limiter')
    appointment, slot = await _load_for_management(session, payload, request)
    if appointment.status not in {
        AppointmentStatus.BOOKED.value,
        AppointmentStatus.CONFIRMED.value,
    }:
        raise _invalid_state('Este agendamento nao pode mais ser cancelado.')
    appointment.status = AppointmentStatus.CANCELLED.value
    appointment.cancelled_at = datetime.now(UTC)
    slot.reserved_count = max(0, slot.reserved_count - 1)
    slot.version += 1
    session.add(
        AuditEvent(
            actor_user_id=None,
            action='APPOINTMENT_CANCELLED',
            target_type='appointment',
            target_id=appointment.id,
            metadata_json={'status': appointment.status},
        )
    )
    await session.commit()
    await session.refresh(appointment)
    return await _appointment_view(session, appointment)


@router.get('/services', response_model=list[PublicServiceRead])
async def list_public_services(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[PublicServiceRead]:
    _consume_limit(request, 'public_query_rate_limiter')
    now = datetime.now(UTC)
    rows = (
        await session.execute(
            select(
                ClinicalService.id,
                ClinicalService.name,
                ClinicalService.duration_minutes,
            )
            .join(ClinicalSession, ClinicalSession.service_id == ClinicalService.id)
            .join(AppointmentSlot, AppointmentSlot.session_id == ClinicalSession.id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .where(
                ClinicalService.is_active.is_(True),
                Clinic.is_active.is_(True),
                ClinicalSession.status == ClinicalSessionStatus.PUBLISHED.value,
                AppointmentSlot.starts_at > now,
                AppointmentSlot.capacity_total > AppointmentSlot.reserved_count,
            )
            .group_by(
                ClinicalService.id,
                ClinicalService.name,
                ClinicalService.duration_minutes,
            )
            .order_by(ClinicalService.name, ClinicalService.id)
        )
    ).all()
    return [
        PublicServiceRead(
            id=service_id,
            name=name,
            duration_minutes=duration_minutes,
        )
        for service_id, name, duration_minutes in rows
    ]


@router.get('/slots', response_model=list[PublicSlotRead])
async def list_public_slots(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service_id: UUID,
    from_at: Annotated[datetime, Query(alias='from')],
    to_at: Annotated[datetime, Query(alias='to')],
    clinic_id: UUID | None = None,
) -> list[PublicSlotRead]:
    _consume_limit(request, 'public_query_rate_limiter')
    if (
        from_at.tzinfo is None
        or to_at.tzinfo is None
        or from_at >= to_at
    ):
        raise ApiError(
            422,
            'VALIDATION_ERROR',
            'O intervalo de consulta e invalido.',
        )
    rows = (
        await session.execute(
            select(
                AppointmentSlot,
                ClinicalService.name,
                ClinicalSession.clinic_id,
                Clinic.name,
            )
            .join(ClinicalSession, ClinicalSession.id == AppointmentSlot.session_id)
            .join(ClinicalService, ClinicalService.id == ClinicalSession.service_id)
            .join(Clinic, Clinic.id == ClinicalSession.clinic_id)
            .where(
                ClinicalSession.service_id == service_id,
                ClinicalSession.status == ClinicalSessionStatus.PUBLISHED.value,
                ClinicalService.is_active.is_(True),
                Clinic.is_active.is_(True),
                AppointmentSlot.starts_at > datetime.now(UTC),
                AppointmentSlot.starts_at < to_at,
                AppointmentSlot.ends_at > from_at,
                AppointmentSlot.capacity_total > AppointmentSlot.reserved_count,
                *(
                    [ClinicalSession.clinic_id == clinic_id]
                    if clinic_id is not None
                    else []
                ),
            )
            .order_by(AppointmentSlot.starts_at, AppointmentSlot.id)
        )
    ).all()
    return [
        PublicSlotRead(
            id=slot.id,
            service_id=service_id,
            service_name=service_name,
            clinic_id=session_clinic_id,
            clinic_name=clinic_name,
            starts_at=slot.starts_at,
            ends_at=slot.ends_at,
            capacity_available=max(0, slot.capacity_total - slot.reserved_count),
        )
        for slot, service_name, session_clinic_id, clinic_name in rows
    ]
