'''Create clinical sessions, student allocations and appointment slots.

Revision ID: 0006_scheduling
Revises: 0005_documents
Create Date: 2026-09-17
'''

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0006_scheduling'
down_revision: str | None = '0005_documents'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'clinical_sessions',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            'term_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('academic_terms.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'service_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('services.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'clinic_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('clinics.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'environment_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('environments.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'supervisor_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('supervisors.user_id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('max_students_override', sa.Integer(), nullable=True),
        sa.Column(
            'status',
            sa.Text(),
            nullable=False,
            server_default='DRAFT',
        ),
        sa.Column(
            'capacity_explanation',
            postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            'starts_at < ends_at',
            name='ck_clinical_sessions_interval',
        ),
        sa.CheckConstraint(
            'max_students_override IS NULL OR max_students_override > 0',
            name='ck_clinical_sessions_limit_positive',
        ),
        sa.CheckConstraint(
            'status IN (\'DRAFT\', \'PUBLISHED\', \'CANCELLED\', \'COMPLETED\')',
            name='ck_clinical_sessions_status',
        ),
    )
    op.create_index(
        'ix_clinical_sessions_term',
        'clinical_sessions',
        ['term_id'],
    )
    op.create_index(
        'ix_clinical_sessions_environment_interval',
        'clinical_sessions',
        ['environment_id', 'starts_at', 'ends_at'],
    )
    op.create_index(
        'ix_clinical_sessions_supervisor_interval',
        'clinical_sessions',
        ['supervisor_id', 'starts_at', 'ends_at'],
    )
    op.create_index(
        'ix_clinical_sessions_status',
        'clinical_sessions',
        ['status'],
    )

    op.create_table(
        'session_allocations',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            'session_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('clinical_sessions.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'student_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('students.user_id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column(
            'status',
            sa.Text(),
            nullable=False,
            server_default='ACTIVE',
        ),
        sa.Column('suspended_reason', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            'status IN (\'ACTIVE\', \'SUSPENDED\', \'CANCELLED\')',
            name='ck_session_allocations_status',
        ),
    )
    op.create_index(
        'uq_session_allocations_active_student',
        'session_allocations',
        ['session_id', 'student_id'],
        unique=True,
        postgresql_where=sa.text('status IN (\'ACTIVE\', \'SUSPENDED\')'),
    )
    op.create_index(
        'ix_session_allocations_session_status',
        'session_allocations',
        ['session_id', 'status'],
    )
    op.create_index(
        'ix_session_allocations_student_status',
        'session_allocations',
        ['student_id', 'status'],
    )

    op.create_table(
        'appointment_slots',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            'session_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('clinical_sessions.id', ondelete='RESTRICT'),
            nullable=False,
        ),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('capacity_total', sa.Integer(), nullable=False),
        sa.Column(
            'reserved_count',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            'starts_at < ends_at',
            name='ck_appointment_slots_interval',
        ),
        sa.CheckConstraint(
            'capacity_total >= 0 AND reserved_count >= 0',
            name='ck_appointment_slots_counts_nonnegative',
        ),
        sa.UniqueConstraint(
            'session_id',
            'starts_at',
            name='uq_appointment_slots_session_start',
        ),
    )
    op.create_index(
        'ix_appointment_slots_lookup',
        'appointment_slots',
        ['session_id', 'starts_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_appointment_slots_lookup', table_name='appointment_slots')
    op.drop_table('appointment_slots')
    op.drop_index(
        'ix_session_allocations_student_status',
        table_name='session_allocations',
    )
    op.drop_index(
        'ix_session_allocations_session_status',
        table_name='session_allocations',
    )
    op.drop_index(
        'uq_session_allocations_active_student',
        table_name='session_allocations',
    )
    op.drop_table('session_allocations')
    op.drop_index(
        'ix_clinical_sessions_status',
        table_name='clinical_sessions',
    )
    op.drop_index(
        'ix_clinical_sessions_supervisor_interval',
        table_name='clinical_sessions',
    )
    op.drop_index(
        'ix_clinical_sessions_environment_interval',
        table_name='clinical_sessions',
    )
    op.drop_index(
        'ix_clinical_sessions_term',
        table_name='clinical_sessions',
    )
    op.drop_table('clinical_sessions')
