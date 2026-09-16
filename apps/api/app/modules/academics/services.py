from collections.abc import Iterable
from datetime import time
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.db.models import ClassBlock
from app.modules.academics.schemas import IntervalPayload


def intervals_overlap(
    first_start: time,
    first_end: time,
    second_start: time,
    second_end: time,
) -> bool:
    return first_start < second_end and second_start < first_end


def ensure_intervals_are_valid(intervals: Iterable[IntervalPayload]) -> None:
    values = list(intervals)
    for index, current in enumerate(values):
        for other in values[index + 1 :]:
            if current.weekday != other.weekday:
                continue
            if intervals_overlap(
                current.start_time,
                current.end_time,
                other.start_time,
                other.end_time,
            ):
                raise ApiError(
                    409,
                    'ACADEMIC_INTERVAL_CONFLICT',
                    'Os intervalos semanais se sobrepoem.',
                    details={
                        'weekday': current.weekday,
                        'conflicting_indexes': [index, index + 1],
                        'time_zone': current.time_zone,
                    },
                )


async def ensure_class_block_is_available(
    session: AsyncSession,
    *,
    cohort_id: UUID,
    weekday: int,
    start_time: time,
    end_time: time,
) -> None:
    conflict = await session.scalar(
        select(ClassBlock.id).where(
            and_(
                ClassBlock.cohort_id == cohort_id,
                ClassBlock.is_active.is_(True),
                ClassBlock.weekday == weekday,
                ClassBlock.start_time < end_time,
                ClassBlock.end_time > start_time,
            )
        )
    )
    if conflict is not None:
        raise ApiError(
            409,
            'ACADEMIC_INTERVAL_CONFLICT',
            'O bloqueio academico se sobrepoe a outro intervalo da turma.',
            details={'cohort_id': str(cohort_id), 'weekday': weekday},
        )


def model_interval_conflict(
    model: Any,
    *,
    owner_column: Any,
    owner_id: UUID,
    term_column: Any,
    term_id: UUID,
    weekday: int,
    start_time: time,
    end_time: time,
) -> Any:
    return select(model.id).where(
        and_(
            owner_column == owner_id,
            term_column == term_id,
            model.weekday == weekday,
            model.start_time < end_time,
            model.end_time > start_time,
        )
    )
