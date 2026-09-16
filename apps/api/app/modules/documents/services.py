from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import (
    ClinicalService,
    DocumentRequirement,
    DocumentSubmission,
    DocumentSubmissionStatus,
    StudentAcademicLink,
    SupervisorServiceScope,
)
from app.modules.documents.schemas import DocumentChecklistItem


@dataclass(frozen=True)
class EligibilityResult:
    items: list[DocumentChecklistItem]
    pending_requirement_ids: list[UUID]

    @property
    def eligible(self) -> bool:
        return not self.pending_requirement_ids


class StudentEligibility:
    async def evaluate(
        self,
        session: AsyncSession,
        student_id: UUID,
        term_id: UUID,
        *,
        now: datetime | None = None,
    ) -> EligibilityResult:
        current_time = now or datetime.now(UTC)
        links = list(
            await session.scalars(
                select(StudentAcademicLink).where(
                    StudentAcademicLink.student_id == student_id,
                    StudentAcademicLink.term_id == term_id,
                )
            )
        )
        discipline_ids = {link.discipline_id for link in links}
        requirements = list(
            await session.scalars(
                select(DocumentRequirement)
                .where(
                    DocumentRequirement.term_id == term_id,
                    DocumentRequirement.is_active.is_(True),
                )
                .order_by(DocumentRequirement.name, DocumentRequirement.id)
            )
        )
        applicable = [
            requirement
            for requirement in requirements
            if requirement.discipline_id is None
            or requirement.discipline_id in discipline_ids
        ]
        requirement_ids = [requirement.id for requirement in applicable]
        submissions = []
        if requirement_ids:
            submissions = list(
                await session.scalars(
                    select(DocumentSubmission)
                    .where(
                        DocumentSubmission.student_id == student_id,
                        DocumentSubmission.requirement_id.in_(requirement_ids),
                    )
                    .order_by(
                        DocumentSubmission.requirement_id,
                        DocumentSubmission.created_at.desc(),
                        DocumentSubmission.id.desc(),
                    )
                )
            )

        latest_by_requirement: dict[UUID, DocumentSubmission] = {}
        approved_by_requirement: dict[UUID, bool] = {}
        expired_changed = False
        for submission in submissions:
            latest_by_requirement.setdefault(submission.requirement_id, submission)
            if (
                submission.status == DocumentSubmissionStatus.APPROVED.value
                and submission.expires_at is not None
                and submission.expires_at <= current_time
            ):
                submission.status = DocumentSubmissionStatus.EXPIRED.value
                expired_changed = True
            if submission.status == DocumentSubmissionStatus.APPROVED.value and (
                submission.expires_at is None or submission.expires_at > current_time
            ):
                approved_by_requirement[submission.requirement_id] = True

        if expired_changed:
            await session.flush()

        pending_ids: list[UUID] = []
        items: list[DocumentChecklistItem] = []
        for requirement in applicable:
            latest = latest_by_requirement.get(requirement.id)
            has_valid_approval = approved_by_requirement.get(requirement.id, False)
            if not has_valid_approval:
                pending_ids.append(requirement.id)
            items.append(
                DocumentChecklistItem(
                    requirement_id=requirement.id,
                    name=requirement.name,
                    discipline_id=requirement.discipline_id,
                    status=latest.status if latest is not None else 'MISSING',
                    review_note=latest.review_note if latest is not None else None,
                    expires_at=latest.expires_at if latest is not None else None,
                    latest_submission_id=latest.id if latest is not None else None,
                )
            )
        return EligibilityResult(items, pending_ids)

    async def ensure_eligible(
        self, session: AsyncSession, student_id: UUID, term_id: UUID
    ) -> None:
        result = await self.evaluate(session, student_id, term_id)
        if not result.eligible:
            raise ApiError(
                409,
                'DOCUMENTS_PENDING',
                'Existem documentos pendentes para esta alocacao.',
                details={
                    'requirement_ids': [
                        str(requirement_id)
                        for requirement_id in result.pending_requirement_ids
                    ]
                },
            )


async def supervisor_can_review(
    session: AsyncSession,
    supervisor_id: UUID,
    requirement: DocumentRequirement,
) -> bool:
    query = (
        select(SupervisorServiceScope.id)
        .join(ClinicalService, ClinicalService.id == SupervisorServiceScope.service_id)
        .where(
            SupervisorServiceScope.supervisor_id == supervisor_id,
            SupervisorServiceScope.term_id == requirement.term_id,
            SupervisorServiceScope.can_review_documents.is_(True),
            SupervisorServiceScope.is_active.is_(True),
            ClinicalService.is_active.is_(True),
        )
    )
    if requirement.discipline_id is not None:
        query = query.where(ClinicalService.discipline_id == requirement.discipline_id)
    return await session.scalar(query.limit(1)) is not None
