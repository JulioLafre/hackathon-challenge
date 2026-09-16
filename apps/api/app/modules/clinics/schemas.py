from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ClinicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    address_label: str = Field(min_length=1, max_length=240)


class ClinicUpdate(ClinicCreate):
    pass


class ClinicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address_label: str
    is_active: bool


class EnvironmentCreate(BaseModel):
    clinic_id: UUID
    name: str = Field(min_length=1, max_length=160)


class EnvironmentUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class EnvironmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clinic_id: UUID
    name: str
    is_active: bool


class RoomCreate(BaseModel):
    environment_id: UUID
    name: str = Field(min_length=1, max_length=160)


class RoomUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    environment_id: UUID
    name: str
    is_active: bool


class EquipmentTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class EquipmentTypeUpdate(EquipmentTypeCreate):
    pass


class EquipmentTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_active: bool


class EnvironmentEquipmentCreate(BaseModel):
    environment_id: UUID
    equipment_type_id: UUID
    quantity: int = Field(ge=0, le=10000)


class EnvironmentEquipmentUpdate(BaseModel):
    quantity: int = Field(ge=0, le=10000)


class EnvironmentEquipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    environment_id: UUID
    equipment_type_id: UUID
    quantity: int
    is_active: bool


class ClinicTermConfigCreate(BaseModel):
    clinic_id: UUID
    term_id: UUID
    max_simultaneous_appointments: int = Field(gt=0, le=10000)
    max_students: int = Field(gt=0, le=10000)


class ClinicTermConfigUpdate(BaseModel):
    max_simultaneous_appointments: int = Field(gt=0, le=10000)
    max_students: int = Field(gt=0, le=10000)


class ClinicTermConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clinic_id: UUID
    term_id: UUID
    max_simultaneous_appointments: int
    max_students: int


class ServiceCreate(BaseModel):
    discipline_id: UUID
    name: str = Field(min_length=1, max_length=160)
    duration_minutes: int = Field(gt=0, le=1440)


class ServiceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    duration_minutes: int = Field(gt=0, le=1440)


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    discipline_id: UUID
    name: str
    duration_minutes: int
    is_active: bool


class ServiceEquipmentRequirementCreate(BaseModel):
    service_id: UUID
    equipment_type_id: UUID
    units_per_appointment: int = Field(gt=0, le=1000)


class ServiceEquipmentRequirementUpdate(BaseModel):
    units_per_appointment: int = Field(gt=0, le=1000)


class ServiceEquipmentRequirementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    service_id: UUID
    equipment_type_id: UUID
    units_per_appointment: int


class SupervisorServiceScopeCreate(BaseModel):
    supervisor_id: UUID
    term_id: UUID
    service_id: UUID
    environment_id: UUID
    can_review_documents: bool = False
    max_students_override: int | None = Field(default=None, gt=0, le=10000)


class SupervisorServiceScopeUpdate(BaseModel):
    can_review_documents: bool
    max_students_override: int | None = Field(default=None, gt=0, le=10000)


class SupervisorServiceScopeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    supervisor_id: UUID
    term_id: UUID
    service_id: UUID
    environment_id: UUID
    can_review_documents: bool
    max_students_override: int | None
    is_active: bool
