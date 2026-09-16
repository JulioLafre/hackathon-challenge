'''Create clinics, resources, services and supervisor scopes.

Revision ID: 0004_clinics
Revises: 0003_academics
Create Date: 2026-09-16
'''

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0004_clinics'
down_revision: str | None = '0003_academics'
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
        'clinics',
        _uuid(),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('address_label', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_clinics_name'),
    )

    op.create_table(
        'equipment_types',
        _uuid(),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_equipment_types_name'),
    )

    op.create_table(
        'environments',
        _uuid(),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ['clinic_id'], ['clinics.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'clinic_id', 'name', name='uq_environments_clinic_name'
        ),
    )
    op.create_index('ix_environments_clinic', 'environments', ['clinic_id'])

    op.create_table(
        'rooms',
        _uuid(),
        sa.Column('environment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ['environment_id'], ['environments.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'environment_id', 'name', name='uq_rooms_environment_name'
        ),
    )
    op.create_index('ix_rooms_environment', 'rooms', ['environment_id'])

    op.create_table(
        'environment_equipments',
        _uuid(),
        sa.Column('environment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'equipment_type_id', postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.CheckConstraint('quantity >= 0', name='ck_environment_equipments_quantity'),
        sa.ForeignKeyConstraint(
            ['environment_id'], ['environments.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['equipment_type_id'], ['equipment_types.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'environment_id',
            'equipment_type_id',
            name='uq_environment_equipments_pair',
        ),
    )
    op.create_index(
        'ix_environment_equipments_environment',
        'environment_equipments',
        ['environment_id'],
    )
    op.create_index(
        'ix_environment_equipments_type',
        'environment_equipments',
        ['equipment_type_id'],
    )

    op.create_table(
        'clinic_term_configs',
        _uuid(),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('max_simultaneous_appointments', sa.Integer(), nullable=False),
        sa.Column('max_students', sa.Integer(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            'max_simultaneous_appointments > 0',
            name='ck_clinic_term_configs_appointments_positive',
        ),
        sa.CheckConstraint(
            'max_students > 0', name='ck_clinic_term_configs_students_positive'
        ),
        sa.ForeignKeyConstraint(
            ['clinic_id'], ['clinics.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'clinic_id', 'term_id', name='uq_clinic_term_configs_clinic_term'
        ),
    )
    op.create_index(
        'ix_clinic_term_configs_clinic', 'clinic_term_configs', ['clinic_id']
    )
    op.create_index(
        'ix_clinic_term_configs_term', 'clinic_term_configs', ['term_id']
    )

    op.create_table(
        'services',
        _uuid(),
        sa.Column('discipline_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.CheckConstraint(
            'duration_minutes > 0', name='ck_services_duration_positive'
        ),
        sa.ForeignKeyConstraint(
            ['discipline_id'], ['disciplines.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'discipline_id', 'name', name='uq_services_discipline_name'
        ),
    )
    op.create_index('ix_services_discipline', 'services', ['discipline_id'])

    op.create_table(
        'service_equipment_requirements',
        _uuid(),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'equipment_type_id', postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column('units_per_appointment', sa.Integer(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            'units_per_appointment > 0',
            name='ck_service_equipment_requirements_units_positive',
        ),
        sa.ForeignKeyConstraint(
            ['service_id'], ['services.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['equipment_type_id'], ['equipment_types.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'service_id',
            'equipment_type_id',
            name='uq_service_equipment_requirements_pair',
        ),
    )
    op.create_index(
        'ix_service_equipment_requirements_service',
        'service_equipment_requirements',
        ['service_id'],
    )
    op.create_index(
        'ix_service_equipment_requirements_type',
        'service_equipment_requirements',
        ['equipment_type_id'],
    )

    op.create_table(
        'supervisor_service_scopes',
        _uuid(),
        sa.Column('supervisor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('term_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('environment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'can_review_documents',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column('max_students_override', sa.Integer(), nullable=True),
        sa.Column(
            'is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False
        ),
        *_timestamps(),
        sa.CheckConstraint(
            'max_students_override IS NULL OR max_students_override > 0',
            name='ck_supervisor_service_scopes_override_positive',
        ),
        sa.ForeignKeyConstraint(
            ['supervisor_id'], ['supervisors.user_id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['term_id'], ['academic_terms.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['service_id'], ['services.id'], ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['environment_id'], ['environments.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'supervisor_id',
            'term_id',
            'service_id',
            'environment_id',
            name='uq_supervisor_service_scopes_context',
        ),
    )
    op.create_index(
        'ix_supervisor_service_scopes_supervisor',
        'supervisor_service_scopes',
        ['supervisor_id'],
    )
    op.create_index(
        'ix_supervisor_service_scopes_term',
        'supervisor_service_scopes',
        ['term_id'],
    )
    op.create_index(
        'ix_supervisor_service_scopes_service',
        'supervisor_service_scopes',
        ['service_id'],
    )
    op.create_index(
        'ix_supervisor_service_scopes_environment',
        'supervisor_service_scopes',
        ['environment_id'],
    )


def downgrade() -> None:
    for index_name, table_name in (
        ('ix_supervisor_service_scopes_environment', 'supervisor_service_scopes'),
        ('ix_supervisor_service_scopes_service', 'supervisor_service_scopes'),
        ('ix_supervisor_service_scopes_term', 'supervisor_service_scopes'),
        ('ix_supervisor_service_scopes_supervisor', 'supervisor_service_scopes'),
        ('ix_service_equipment_requirements_type', 'service_equipment_requirements'),
        (
            'ix_service_equipment_requirements_service',
            'service_equipment_requirements',
        ),
        ('ix_services_discipline', 'services'),
        ('ix_clinic_term_configs_term', 'clinic_term_configs'),
        ('ix_clinic_term_configs_clinic', 'clinic_term_configs'),
        ('ix_environment_equipments_type', 'environment_equipments'),
        ('ix_environment_equipments_environment', 'environment_equipments'),
        ('ix_rooms_environment', 'rooms'),
        ('ix_environments_clinic', 'environments'),
    ):
        op.drop_index(index_name, table_name=table_name)

    for table_name in (
        'supervisor_service_scopes',
        'service_equipment_requirements',
        'services',
        'clinic_term_configs',
        'environment_equipments',
        'rooms',
        'environments',
        'equipment_types',
        'clinics',
    ):
        op.drop_table(table_name)
