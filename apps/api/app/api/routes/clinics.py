from typing import Annotated, Any, TypeVar, cast
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    AcademicTerm,
    Clinic,
    ClinicalService,
    ClinicTermConfig,
    Course,
    Discipline,
    Environment,
    EnvironmentEquipment,
    EquipmentType,
    Role,
    Room,
    ServiceEquipmentRequirement,
    Supervisor,
    SupervisorServiceScope,
    TermStatus,
    User,
)
from app.modules.auth.dependencies import get_db_session, require_roles
from app.modules.clinics.schemas import (
    ClinicCreate,
    ClinicRead,
    ClinicTermConfigCreate,
    ClinicTermConfigRead,
    ClinicTermConfigUpdate,
    ClinicUpdate,
    EnvironmentCreate,
    EnvironmentEquipmentCreate,
    EnvironmentEquipmentRead,
    EnvironmentEquipmentUpdate,
    EnvironmentRead,
    EnvironmentUpdate,
    EquipmentTypeCreate,
    EquipmentTypeRead,
    EquipmentTypeUpdate,
    RoomCreate,
    RoomRead,
    RoomUpdate,
    ServiceCreate,
    ServiceEquipmentRequirementCreate,
    ServiceEquipmentRequirementRead,
    ServiceEquipmentRequirementUpdate,
    ServiceRead,
    ServiceUpdate,
    SupervisorServiceScopeCreate,
    SupervisorServiceScopeRead,
    SupervisorServiceScopeUpdate,
)

router = APIRouter(tags=['clinics'])
MasterUser = Annotated[User, Depends(require_roles(Role.MASTER))]
ModelT = TypeVar('ModelT')


def not_found(resource: str) -> ApiError:
    return ApiError(404, 'NOT_FOUND', f'{resource} nao encontrado.')


def inactive(resource: str) -> ApiError:
    return ApiError(
        422,
        'RESOURCE_INACTIVE',
        f'{resource} esta desativado e nao pode entrar em nova configuracao.',
    )


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


async def load(
    session: AsyncSession,
    model: type[ModelT],
    entity_id: UUID,
    resource: str,
) -> ModelT:
    entity = await session.get(model, entity_id)
    if entity is None:
        raise not_found(resource)
    return entity


def ensure_active(entity: ModelT, resource: str) -> ModelT:
    if not cast(Any, entity).is_active:
        raise inactive(resource)
    return entity


async def load_active(
    session: AsyncSession,
    model: type[ModelT],
    entity_id: UUID,
    resource: str,
) -> ModelT:
    return ensure_active(await load(session, model, entity_id, resource), resource)


async def ensure_term_open(
    session: AsyncSession, term_id: UUID
) -> AcademicTerm:
    term = await load(session, AcademicTerm, term_id, 'Semestre')
    if term.status == TermStatus.CLOSED.value:
        raise invalid_state('Semestre fechado e somente leitura.')
    return term


async def ensure_discipline_active(
    session: AsyncSession, discipline_id: UUID
) -> Discipline:
    discipline = await load_active(
        session, Discipline, discipline_id, 'Disciplina'
    )
    await load_active(session, Course, discipline.course_id, 'Curso')
    return discipline


@router.get('/clinics', response_model=list[ClinicRead])
async def list_clinics(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Clinic]:
    result = await session.scalars(select(Clinic).order_by(Clinic.name))
    return list(result)


@router.post(
    '/clinics', response_model=ClinicRead, status_code=status.HTTP_201_CREATED
)
async def create_clinic(
    payload: ClinicCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Clinic:
    clinic = Clinic(
        name=payload.name.strip(),
        address_label=payload.address_label.strip(),
    )
    session.add(clinic)
    await commit_or_duplicate(session)
    await session.refresh(clinic)
    return clinic


@router.patch('/clinics/{clinic_id}', response_model=ClinicRead)
async def update_clinic(
    clinic_id: UUID,
    payload: ClinicUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Clinic:
    clinic = await load(session, Clinic, clinic_id, 'Clinica')
    clinic.name = payload.name.strip()
    clinic.address_label = payload.address_label.strip()
    await commit_or_duplicate(session)
    await session.refresh(clinic)
    return clinic


@router.post('/clinics/{clinic_id}/deactivate', response_model=ClinicRead)
async def deactivate_clinic(
    clinic_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Clinic:
    clinic = await load(session, Clinic, clinic_id, 'Clinica')
    clinic.is_active = False
    await session.commit()
    await session.refresh(clinic)
    return clinic


@router.get('/environments', response_model=list[EnvironmentRead])
async def list_environments(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Environment]:
    result = await session.scalars(select(Environment).order_by(Environment.name))
    return list(result)


@router.post(
    '/environments',
    response_model=EnvironmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_environment(
    payload: EnvironmentCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Environment:
    await load_active(session, Clinic, payload.clinic_id, 'Clinica')
    environment = Environment(
        clinic_id=payload.clinic_id,
        name=payload.name.strip(),
    )
    session.add(environment)
    await commit_or_duplicate(session)
    await session.refresh(environment)
    return environment


@router.patch('/environments/{environment_id}', response_model=EnvironmentRead)
async def update_environment(
    environment_id: UUID,
    payload: EnvironmentUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Environment:
    environment = await load(session, Environment, environment_id, 'Ambiente')
    environment.name = payload.name.strip()
    await commit_or_duplicate(session)
    await session.refresh(environment)
    return environment


@router.post(
    '/environments/{environment_id}/deactivate',
    response_model=EnvironmentRead,
)
async def deactivate_environment(
    environment_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Environment:
    environment = await load(session, Environment, environment_id, 'Ambiente')
    environment.is_active = False
    await session.commit()
    await session.refresh(environment)
    return environment


@router.get('/rooms', response_model=list[RoomRead])
async def list_rooms(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[Room]:
    result = await session.scalars(select(Room).order_by(Room.name))
    return list(result)


@router.post(
    '/rooms', response_model=RoomRead, status_code=status.HTTP_201_CREATED
)
async def create_room(
    payload: RoomCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Room:
    await load_active(session, Environment, payload.environment_id, 'Ambiente')
    room = Room(environment_id=payload.environment_id, name=payload.name.strip())
    session.add(room)
    await commit_or_duplicate(session)
    await session.refresh(room)
    return room


@router.patch('/rooms/{room_id}', response_model=RoomRead)
async def update_room(
    room_id: UUID,
    payload: RoomUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Room:
    room = await load(session, Room, room_id, 'Sala')
    room.name = payload.name.strip()
    await commit_or_duplicate(session)
    await session.refresh(room)
    return room


@router.post('/rooms/{room_id}/deactivate', response_model=RoomRead)
async def deactivate_room(
    room_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> Room:
    room = await load(session, Room, room_id, 'Sala')
    room.is_active = False
    await session.commit()
    await session.refresh(room)
    return room


@router.get('/equipment-types', response_model=list[EquipmentTypeRead])
async def list_equipment_types(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[EquipmentType]:
    result = await session.scalars(select(EquipmentType).order_by(EquipmentType.name))
    return list(result)


@router.post(
    '/equipment-types',
    response_model=EquipmentTypeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_equipment_type(
    payload: EquipmentTypeCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EquipmentType:
    equipment_type = EquipmentType(name=payload.name.strip())
    session.add(equipment_type)
    await commit_or_duplicate(session)
    await session.refresh(equipment_type)
    return equipment_type


@router.patch(
    '/equipment-types/{equipment_type_id}', response_model=EquipmentTypeRead
)
async def update_equipment_type(
    equipment_type_id: UUID,
    payload: EquipmentTypeUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EquipmentType:
    equipment_type = await load(
        session, EquipmentType, equipment_type_id, 'Tipo de equipamento'
    )
    equipment_type.name = payload.name.strip()
    await commit_or_duplicate(session)
    await session.refresh(equipment_type)
    return equipment_type


@router.post(
    '/equipment-types/{equipment_type_id}/deactivate',
    response_model=EquipmentTypeRead,
)
async def deactivate_equipment_type(
    equipment_type_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EquipmentType:
    equipment_type = await load(
        session, EquipmentType, equipment_type_id, 'Tipo de equipamento'
    )
    equipment_type.is_active = False
    await session.commit()
    await session.refresh(equipment_type)
    return equipment_type


@router.get(
    '/environment-equipments', response_model=list[EnvironmentEquipmentRead]
)
async def list_environment_equipments(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[EnvironmentEquipment]:
    result = await session.scalars(
        select(EnvironmentEquipment).order_by(EnvironmentEquipment.created_at)
    )
    return list(result)


@router.post(
    '/environment-equipments',
    response_model=EnvironmentEquipmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_environment_equipment(
    payload: EnvironmentEquipmentCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EnvironmentEquipment:
    await load_active(session, Environment, payload.environment_id, 'Ambiente')
    await load_active(
        session, EquipmentType, payload.equipment_type_id, 'Tipo de equipamento'
    )
    equipment = EnvironmentEquipment(**payload.model_dump())
    session.add(equipment)
    await commit_or_duplicate(session)
    await session.refresh(equipment)
    return equipment


@router.patch(
    '/environment-equipments/{equipment_id}',
    response_model=EnvironmentEquipmentRead,
)
async def update_environment_equipment(
    equipment_id: UUID,
    payload: EnvironmentEquipmentUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EnvironmentEquipment:
    equipment = await load(
        session, EnvironmentEquipment, equipment_id, 'Equipamento no ambiente'
    )
    equipment.quantity = payload.quantity
    await commit_or_duplicate(session)
    await session.refresh(equipment)
    return equipment


@router.post(
    '/environment-equipments/{equipment_id}/deactivate',
    response_model=EnvironmentEquipmentRead,
)
async def deactivate_environment_equipment(
    equipment_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> EnvironmentEquipment:
    equipment = await load(
        session, EnvironmentEquipment, equipment_id, 'Equipamento no ambiente'
    )
    equipment.is_active = False
    await session.commit()
    await session.refresh(equipment)
    return equipment


@router.get('/clinic-term-configs', response_model=list[ClinicTermConfigRead])
async def list_clinic_term_configs(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[ClinicTermConfig]:
    result = await session.scalars(
        select(ClinicTermConfig).order_by(ClinicTermConfig.created_at)
    )
    return list(result)


@router.post(
    '/clinic-term-configs',
    response_model=ClinicTermConfigRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_clinic_term_config(
    payload: ClinicTermConfigCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClinicTermConfig:
    await load_active(session, Clinic, payload.clinic_id, 'Clinica')
    await ensure_term_open(session, payload.term_id)
    config = ClinicTermConfig(**payload.model_dump())
    session.add(config)
    await commit_or_duplicate(session)
    await session.refresh(config)
    return config


@router.patch(
    '/clinic-term-configs/{config_id}', response_model=ClinicTermConfigRead
)
async def update_clinic_term_config(
    config_id: UUID,
    payload: ClinicTermConfigUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClinicTermConfig:
    config = await load(session, ClinicTermConfig, config_id, 'Configuracao da clinica')
    await ensure_term_open(session, config.term_id)
    config.max_simultaneous_appointments = payload.max_simultaneous_appointments
    config.max_students = payload.max_students
    await commit_or_duplicate(session)
    await session.refresh(config)
    return config


@router.get('/services', response_model=list[ServiceRead])
async def list_services(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[ClinicalService]:
    result = await session.scalars(
        select(ClinicalService).order_by(ClinicalService.name)
    )
    return list(result)


@router.post(
    '/services', response_model=ServiceRead, status_code=status.HTTP_201_CREATED
)
async def create_service(
    payload: ServiceCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClinicalService:
    await ensure_discipline_active(session, payload.discipline_id)
    service = ClinicalService(
        discipline_id=payload.discipline_id,
        name=payload.name.strip(),
        duration_minutes=payload.duration_minutes,
    )
    session.add(service)
    await commit_or_duplicate(session)
    await session.refresh(service)
    return service


@router.patch('/services/{service_id}', response_model=ServiceRead)
async def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClinicalService:
    service = await load(session, ClinicalService, service_id, 'Servico')
    service.name = payload.name.strip()
    service.duration_minutes = payload.duration_minutes
    await commit_or_duplicate(session)
    await session.refresh(service)
    return service


@router.post('/services/{service_id}/deactivate', response_model=ServiceRead)
async def deactivate_service(
    service_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ClinicalService:
    service = await load(session, ClinicalService, service_id, 'Servico')
    service.is_active = False
    await session.commit()
    await session.refresh(service)
    return service


@router.get(
    '/service-equipment-requirements',
    response_model=list[ServiceEquipmentRequirementRead],
)
async def list_service_equipment_requirements(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[ServiceEquipmentRequirement]:
    result = await session.scalars(
        select(ServiceEquipmentRequirement).order_by(
            ServiceEquipmentRequirement.created_at
        )
    )
    return list(result)


@router.post(
    '/service-equipment-requirements',
    response_model=ServiceEquipmentRequirementRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_service_equipment_requirement(
    payload: ServiceEquipmentRequirementCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ServiceEquipmentRequirement:
    await load_active(session, ClinicalService, payload.service_id, 'Servico')
    await load_active(
        session, EquipmentType, payload.equipment_type_id, 'Tipo de equipamento'
    )
    requirement = ServiceEquipmentRequirement(**payload.model_dump())
    session.add(requirement)
    await commit_or_duplicate(session)
    await session.refresh(requirement)
    return requirement


@router.patch(
    '/service-equipment-requirements/{requirement_id}',
    response_model=ServiceEquipmentRequirementRead,
)
async def update_service_equipment_requirement(
    requirement_id: UUID,
    payload: ServiceEquipmentRequirementUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> ServiceEquipmentRequirement:
    requirement = await load(
        session,
        ServiceEquipmentRequirement,
        requirement_id,
        'Requisito de equipamento',
    )
    requirement.units_per_appointment = payload.units_per_appointment
    await commit_or_duplicate(session)
    await session.refresh(requirement)
    return requirement


@router.get(
    '/supervisor-service-scopes',
    response_model=list[SupervisorServiceScopeRead],
)
async def list_supervisor_service_scopes(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> list[SupervisorServiceScope]:
    result = await session.scalars(
        select(SupervisorServiceScope).order_by(
            SupervisorServiceScope.created_at
        )
    )
    return list(result)


@router.post(
    '/supervisor-service-scopes',
    response_model=SupervisorServiceScopeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_supervisor_service_scope(
    payload: SupervisorServiceScopeCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> SupervisorServiceScope:
    await load(session, Supervisor, payload.supervisor_id, 'Supervisor')
    user = await load(session, User, payload.supervisor_id, 'Usuario')
    if not user.is_active:
        raise inactive('Supervisor')
    await ensure_term_open(session, payload.term_id)
    await load_active(session, ClinicalService, payload.service_id, 'Servico')
    environment = await load_active(
        session, Environment, payload.environment_id, 'Ambiente'
    )
    await load_active(session, Clinic, environment.clinic_id, 'Clinica')
    scope = SupervisorServiceScope(**payload.model_dump())
    session.add(scope)
    await commit_or_duplicate(session)
    await session.refresh(scope)
    return scope


@router.patch(
    '/supervisor-service-scopes/{scope_id}',
    response_model=SupervisorServiceScopeRead,
)
async def update_supervisor_service_scope(
    scope_id: UUID,
    payload: SupervisorServiceScopeUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> SupervisorServiceScope:
    scope = await load(
        session, SupervisorServiceScope, scope_id, 'Escopo do supervisor'
    )
    scope.can_review_documents = payload.can_review_documents
    scope.max_students_override = payload.max_students_override
    await commit_or_duplicate(session)
    await session.refresh(scope)
    return scope


@router.post(
    '/supervisor-service-scopes/{scope_id}/deactivate',
    response_model=SupervisorServiceScopeRead,
)
async def deactivate_supervisor_service_scope(
    scope_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    _: MasterUser,
) -> SupervisorServiceScope:
    scope = await load(
        session, SupervisorServiceScope, scope_id, 'Escopo do supervisor'
    )
    scope.is_active = False
    await session.commit()
    await session.refresh(scope)
    return scope
