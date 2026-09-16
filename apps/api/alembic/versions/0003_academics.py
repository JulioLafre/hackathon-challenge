'''Create academic configuration and availability tables.

Revision ID: 0003_academics
Revises: 0002_users
Create Date: 2026-09-16
'''

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0003_academics'
down_revision: str | None = '0002_users'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'academic_terms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('ends_on', sa.Date(), nullable=False),
        sa.Column(
            'status',
            sa.Text(),
            server_default=sa.text('\'DRAFT\''),
            nullable=False,
        ),
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
        sa.CheckConstraint('ends_on > starts_on', name='ck_academic_terms_dates'),
        sa.CheckConstraint(
            'status IN (\'DRAFT\', \'ACTIVE\', \'CLOSED\')',
            name='ck_academic_terms_status',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_academic_terms_name'),
    )
    op.create_index(
        'uq_academic_terms_active',
        'academic_terms',
        ['status'],
        unique=True,
        postgresql_where=sa.text('status = \'ACTIVE\''),
    )

    op.create_table(
        'courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
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
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_courses_code'),
    )

    op.create_table(
        'disciplines',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('kind', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
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
        sa.CheckConstraint(
            'kind IN (\'DISCIPLINE\', \'INTERNSHIP\')',
            name='ck_disciplines_kind',
        ),
        sa.ForeignKeyConstraint(
            ['course_id'], ['courses.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_disciplines_code'),
    )
    op.create_index('ix_disciplines_course', 'disciplines', ['course_id'])

    op.create_table(
        'cohorts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period', sa.Integer(), nullable=False),
        sa.Column('label', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
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
        sa.CheckConstraint('period > 0', name='ck_cohorts_period_positive'),
        sa.ForeignKeyConstraint(
            ['course_id'], ['courses.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'term_id',
            'course_id',
            'period',
            'label',
            name='uq_cohorts_term_course_period_label',
        ),
    )
    op.create_index('ix_cohorts_term', 'cohorts', ['term_id'])

    op.create_table(
        'class_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cohort_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('discipline_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column(
            'time_zone',
            sa.Text(),
            server_default=sa.text('\'America/Sao_Paulo\''),
            nullable=False,
        ),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
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
        sa.CheckConstraint(
            'weekday BETWEEN 0 AND 6', name='ck_class_blocks_weekday'
        ),
        sa.CheckConstraint(
            'start_time < end_time', name='ck_class_blocks_interval'
        ),
        sa.CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'',
            name='ck_class_blocks_time_zone',
        ),
        sa.ForeignKeyConstraint(
            ['cohort_id'], ['cohorts.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['discipline_id'], ['disciplines.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_class_blocks_cohort', 'class_blocks', ['cohort_id'])

    op.create_table(
        'students',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('registration', sa.Text(), nullable=False),
        sa.Column('full_name', sa.Text(), nullable=False),
        sa.Column('phone', sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('user_id'),
        sa.UniqueConstraint('registration'),
    )

    op.create_table(
        'supervisors',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.Text(), nullable=False),
        sa.Column('full_name', sa.Text(), nullable=False),
        sa.Column('professional_area', sa.Text(), nullable=False),
        sa.Column('max_students_default', sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            'kind IN (\'PROFESSOR\', \'PRECEPTOR\')',
            name='ck_supervisors_kind',
        ),
        sa.CheckConstraint(
            'max_students_default > 0', name='ck_supervisors_limit_positive'
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('user_id'),
    )

    op.create_table(
        'student_academic_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cohort_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('discipline_id', postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ['cohort_id'], ['cohorts.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['discipline_id'], ['disciplines.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['student_id'], ['students.user_id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'student_id',
            'term_id',
            'cohort_id',
            'discipline_id',
            name='uq_student_academic_links_context',
        ),
    )
    op.create_index(
        'ix_student_academic_links_student',
        'student_academic_links',
        ['student_id'],
    )
    op.create_index(
        'ix_student_academic_links_term',
        'student_academic_links',
        ['term_id'],
    )

    op.create_table(
        'student_availabilities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column(
            'time_zone',
            sa.Text(),
            server_default=sa.text('\'America/Sao_Paulo\''),
            nullable=False,
        ),
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
        sa.CheckConstraint(
            'weekday BETWEEN 0 AND 6',
            name='ck_student_availabilities_weekday',
        ),
        sa.CheckConstraint(
            'start_time < end_time',
            name='ck_student_availabilities_interval',
        ),
        sa.CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'',
            name='ck_student_availabilities_time_zone',
        ),
        sa.ForeignKeyConstraint(
            ['student_id'], ['students.user_id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_student_availabilities_lookup',
        'student_availabilities',
        ['student_id', 'term_id'],
    )

    op.create_table(
        'supervisor_availabilities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('supervisor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column(
            'time_zone',
            sa.Text(),
            server_default=sa.text('\'America/Sao_Paulo\''),
            nullable=False,
        ),
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
        sa.CheckConstraint(
            'weekday BETWEEN 0 AND 6',
            name='ck_supervisor_availabilities_weekday',
        ),
        sa.CheckConstraint(
            'start_time < end_time',
            name='ck_supervisor_availabilities_interval',
        ),
        sa.CheckConstraint(
            'time_zone = \'America/Sao_Paulo\'',
            name='ck_supervisor_availabilities_time_zone',
        ),
        sa.ForeignKeyConstraint(
            ['supervisor_id'], ['supervisors.user_id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_supervisor_availabilities_lookup',
        'supervisor_availabilities',
        ['supervisor_id', 'term_id'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_supervisor_availabilities_lookup',
        table_name='supervisor_availabilities',
    )
    op.drop_table('supervisor_availabilities')
    op.drop_index(
        'ix_student_availabilities_lookup',
        table_name='student_availabilities',
    )
    op.drop_table('student_availabilities')
    op.drop_index(
        'ix_student_academic_links_term',
        table_name='student_academic_links',
    )
    op.drop_index(
        'ix_student_academic_links_student',
        table_name='student_academic_links',
    )
    op.drop_table('student_academic_links')
    op.drop_table('supervisors')
    op.drop_table('students')
    op.drop_index('ix_class_blocks_cohort', table_name='class_blocks')
    op.drop_table('class_blocks')
    op.drop_index('ix_cohorts_term', table_name='cohorts')
    op.drop_table('cohorts')
    op.drop_index('ix_disciplines_course', table_name='disciplines')
    op.drop_table('disciplines')
    op.drop_table('courses')
    op.drop_index('uq_academic_terms_active', table_name='academic_terms')
    op.drop_table('academic_terms')
