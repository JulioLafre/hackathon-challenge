'''Create document requirements, submissions and audit events.

Revision ID: 0005_documents
Revises: 0004_clinics
Create Date: 2026-09-16
'''

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0005_documents'
down_revision: str | None = '0004_clinics'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _uuid() -> sa.Column[object]:
    return sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False)


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.create_table(
        'document_requirements',
        _uuid(),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('discipline_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column(
            'expires_required',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column(
            'is_active',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['discipline_id'], ['disciplines.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'term_id',
            'discipline_id',
            'name',
            name='uq_document_requirements_context_name',
        ),
    )
    op.create_index(
        'uq_document_requirements_global_name',
        'document_requirements',
        ['term_id', 'name'],
        unique=True,
        postgresql_where=sa.text('discipline_id IS NULL'),
    )
    op.create_index(
        'ix_document_requirements_term', 'document_requirements', ['term_id']
    )
    op.create_index(
        'ix_document_requirements_discipline',
        'document_requirements',
        ['discipline_id'],
    )

    op.create_table(
        'document_submissions',
        _uuid(),
        sa.Column('requirement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.Text(), nullable=False),
        sa.Column('original_name', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.Text(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Text(),
            server_default=sa.text("'PENDING_REVIEW'"),
            nullable=False,
        ),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED')",
            name='ck_document_submissions_status',
        ),
        sa.CheckConstraint(
            'size_bytes > 0 AND size_bytes <= 10485760',
            name='ck_document_submissions_size',
        ),
        sa.CheckConstraint(
            "status <> 'REJECTED' OR (review_note IS NOT NULL AND length(trim(review_note)) > 0)",
            name='ck_document_submissions_rejection_note',
        ),
        sa.ForeignKeyConstraint(
            ['requirement_id'], ['document_requirements.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['student_id'], ['students.user_id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['reviewed_by'], ['users.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storage_key', name='uq_document_submissions_storage_key'),
    )
    op.create_index(
        'ix_document_submissions_requirement_status',
        'document_submissions',
        ['requirement_id', 'status'],
    )
    op.create_index(
        'ix_document_submissions_student_requirement',
        'document_submissions',
        ['student_id', 'requirement_id'],
    )
    op.create_index(
        'ix_document_submissions_review_queue',
        'document_submissions',
        ['status', 'created_at'],
    )

    op.create_table(
        'audit_events',
        _uuid(),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.Text(), nullable=False),
        sa.Column('target_type', sa.Text(), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'occurred_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column(
            'metadata_json',
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['actor_user_id'], ['users.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_audit_events_target', 'audit_events', ['target_type', 'target_id']
    )
    op.create_index(
        'ix_audit_events_actor', 'audit_events', ['actor_user_id', 'occurred_at']
    )
    op.create_index('ix_audit_events_occurred_at', 'audit_events', ['occurred_at'])


def downgrade() -> None:
    for index_name, table_name in (
        ('ix_audit_events_occurred_at', 'audit_events'),
        ('ix_audit_events_actor', 'audit_events'),
        ('ix_audit_events_target', 'audit_events'),
        ('ix_document_submissions_review_queue', 'document_submissions'),
        ('ix_document_submissions_student_requirement', 'document_submissions'),
        ('ix_document_submissions_requirement_status', 'document_submissions'),
        ('ix_document_requirements_discipline', 'document_requirements'),
        ('ix_document_requirements_term', 'document_requirements'),
        ('uq_document_requirements_global_name', 'document_requirements'),
    ):
        op.drop_index(index_name, table_name=table_name)

    op.drop_table('audit_events')
    op.drop_table('document_submissions')
    op.drop_table('document_requirements')
