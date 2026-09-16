from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentRequirementCreate(BaseModel):
    term_id: UUID
    discipline_id: UUID | None = None
    name: str = Field(min_length=1, max_length=160)
    expires_required: bool = False


class DocumentRequirementUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    expires_required: bool


class DocumentRequirementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    discipline_id: UUID | None
    name: str
    expires_required: bool
    is_active: bool


class DocumentChecklistItem(BaseModel):
    requirement_id: UUID
    name: str
    discipline_id: UUID | None
    status: str
    review_note: str | None
    expires_at: datetime | None
    latest_submission_id: UUID | None


class DocumentChecklistRead(BaseModel):
    term_id: UUID
    eligible: bool
    pending_requirement_ids: list[UUID]
    items: list[DocumentChecklistItem]


class DocumentSubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    requirement_id: UUID
    student_id: UUID
    original_name: str
    mime_type: str
    size_bytes: int
    status: str
    expires_at: datetime | None
    review_note: str | None
    reviewed_by: UUID | None
    reviewed_at: datetime | None


class DocumentReviewRead(DocumentSubmissionRead):
    student_name: str
    requirement_name: str
    discipline_id: UUID | None


class DocumentApproveRequest(BaseModel):
    expires_at: datetime | None = None


class DocumentRejectRequest(BaseModel):
    review_note: str = Field(min_length=1, max_length=2000)
