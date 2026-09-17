'''Create public appointments and equipment allocations.'''

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0007_booking'
down_revision: str | None = '0006_scheduling'
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
    appointments = [_uuid()]
    appointments.extend(
        [
            sa.Column('slot_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                'allocation_id', postgresql.UUID(as_uuid=True), nullable=False
            ),
            sa.Column('room_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('public_name', sa.Text(), nullable=False),
            sa.Column('public_email', sa.Text(), nullable=True),
            sa.Column('public_phone', sa.Text(), nullable=True),
            sa.Column('privacy_notice_version', sa.Text(), nullable=False),
        ]
    )
    appointments.extend(
        [
            sa.Column(
                'status',
                sa.Text(),
                server_default=sa.text(chr(39) + 'BOOKED' + chr(39)),
                nullable=False,
            ),
            sa.Column(
                'risk_status',
                sa.Text(),
                server_default=sa.text(chr(39) + 'NONE' + chr(39)),
                nullable=False,
            ),
            sa.Column('management_token_hash', sa.Text(), nullable=False),
            sa.Column('idempotency_key', sa.Text(), nullable=False),
            sa.Column(
                'confirmed_at',
                sa.DateTime(timezone=True),
                nullable=True,
            ),
            sa.Column(
                'cancelled_at',
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        ]
    )
    appointments.extend(_timestamps())
    appointments.append(
        sa.CheckConstraint(
            'status IN (\'BOOKED\', \'CONFIRMED\', \'CANCELLED\', \'COMPLETED\', \'NO_SHOW\')',
            name='ck_appointments_status',
        )
    )
    appointments.append(
        sa.CheckConstraint(
            'risk_status IN (\'NONE\', \'AT_RISK\', \'RESOLVED\')',
            name='ck_appointments_risk_status',
        )
    )
    appointments.append(
        sa.CheckConstraint(
            '(public_email IS NOT NULL AND length(trim(public_email)) > 0) '
            'OR (public_phone IS NOT NULL AND length(trim(public_phone)) > 0)',
            name='ck_appointments_contact_required',
        )
    )
    appointments.extend(
        [
            sa.ForeignKeyConstraint(
                ['slot_id'], ['appointment_slots.id'], ondelete='RESTRICT'
            ),
            sa.ForeignKeyConstraint(
                ['allocation_id'],
                ['session_allocations.id'],
                ondelete='RESTRICT',
            ),
            sa.ForeignKeyConstraint(
                ['room_id'], ['rooms.id'], ondelete='RESTRICT'
            ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint(
                'management_token_hash',
                name='uq_appointments_management_token_hash',
            ),
            sa.UniqueConstraint(
                'idempotency_key',
                name='uq_appointments_idempotency_key',
            ),
        ]
    )
    op.create_table('appointments', *appointments)
    op.create_index(
        'ix_appointments_slot_status',
        'appointments',
        ['slot_id', 'status'],
    )
    op.create_index(
        'uq_appointments_slot_allocation_active',
        'appointments',
        ['slot_id', 'allocation_id'],
        unique=True,
        postgresql_where=sa.text(
            'status IN (\'BOOKED\', \'CONFIRMED\')'
        ),
    )
    op.create_index(
        'ix_appointments_allocation_status',
        'appointments',
        ['allocation_id', 'status'],
    )
    op.create_index(
        'ix_appointments_room',
        'appointments',
        ['room_id', 'status'],
    )
    equipment = [_uuid()]
    equipment.extend(
        [
            sa.Column(
                'appointment_id',
                postgresql.UUID(as_uuid=True),
                nullable=False,
            ),
            sa.Column(
                'environment_equipment_id',
                postgresql.UUID(as_uuid=True),
                nullable=False,
            ),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.text('CURRENT_TIMESTAMP'),
                nullable=False,
            ),
        ]
    )
    equipment.extend(
        [
            sa.CheckConstraint(
                'quantity > 0',
                name='ck_appointment_equipment_allocations_quantity_positive',
            ),
            sa.ForeignKeyConstraint(
                ['appointment_id'],
                ['appointments.id'],
                ondelete='RESTRICT',
            ),
            sa.ForeignKeyConstraint(
                ['environment_equipment_id'],
                ['environment_equipments.id'],
                ondelete='RESTRICT',
            ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint(
                'appointment_id',
                'environment_equipment_id',
                name='uq_appointment_equipment_allocations_pair',
            ),
        ]
    )
    op.create_table('appointment_equipment_allocations', *equipment)
    op.create_index(
        'ix_appointment_equipment_allocations_appointment',
        'appointment_equipment_allocations',
        ['appointment_id'],
    )
    op.create_index(
        'ix_appointment_equipment_allocations_inventory',
        'appointment_equipment_allocations',
        ['environment_equipment_id'],
    )


def downgrade() -> None:
    op.drop_index(
        'ix_appointment_equipment_allocations_inventory',
        table_name='appointment_equipment_allocations',
    )
    op.drop_index(
        'ix_appointment_equipment_allocations_appointment',
        table_name='appointment_equipment_allocations',
    )
    op.drop_table('appointment_equipment_allocations')
    op.drop_index('ix_appointments_room', table_name='appointments')
    op.drop_index(
        'ix_appointments_allocation_status',
        table_name='appointments',
    )
    op.drop_index(
        'uq_appointments_slot_allocation_active',
        table_name='appointments',
    )
    op.drop_index('ix_appointments_slot_status', table_name='appointments')
    op.drop_table('appointments')
