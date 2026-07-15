"""multi-project support: projects table, project_id columns, backfill Portugal-2026

Revision ID: 010_multi_project_support
Revises: 009_user_last_login
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '010_multi_project_support'
down_revision = '009_user_last_login'
branch_labels = None
depends_on = None

PORTUGAL_UUID = 'a0000000-0000-0000-0000-000000000001'


def upgrade() -> None:
    # Step 1: Create projects table
    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('default_language', sa.String(10), nullable=False, server_default='pt'),
        sa.Column('bg_color', sa.String(7), nullable=False, server_default='#006600'),
        sa.Column('text_color', sa.String(7), nullable=False, server_default='#FFFFFF'),
        sa.Column('accent_color', sa.String(7), nullable=False, server_default='#FFD700'),
        sa.Column('status', sa.String(10), nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('open', 'closed')", name='ck_projects_status'),
    )
    op.create_index('ix_projects_status', 'projects', ['status'])

    # Step 2: Insert Portugal-2026 seed row
    op.execute(
        f"INSERT INTO projects (id, name, default_language, bg_color, text_color, accent_color, status) "
        f"VALUES ('{PORTUGAL_UUID}', 'Portugal-2026', 'pt', '#006600', '#FFFFFF', '#FFD700', 'open')"
    )

    # Step 3: Add nullable project_id to tickets
    op.add_column('tickets', sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True))

    # Step 4: Add nullable project_id to categories
    op.add_column('categories', sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True))

    # Step 5: Add nullable project_id to app_users
    op.add_column('app_users', sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True))

    # Step 6: Backfill tickets
    op.execute(f"UPDATE tickets SET project_id = '{PORTUGAL_UUID}' WHERE project_id IS NULL")

    # Step 7: Backfill categories
    op.execute(f"UPDATE categories SET project_id = '{PORTUGAL_UUID}' WHERE project_id IS NULL")

    # Step 8: Backfill app_users (user role only)
    op.execute(f"UPDATE app_users SET project_id = '{PORTUGAL_UUID}' WHERE role = 'user'")

    # Step 9: Set tickets.project_id NOT NULL
    op.alter_column('tickets', 'project_id', nullable=False)

    # Step 10: Set categories.project_id NOT NULL
    op.alter_column('categories', 'project_id', nullable=False)

    # Step 11: Create project_members join table
    op.create_table(
        'project_members',
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('family_members.id', ondelete='RESTRICT'), nullable=False, primary_key=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Step 12: Backfill project_members with all existing family_members
    op.execute(
        f"INSERT INTO project_members (project_id, member_id) "
        f"SELECT '{PORTUGAL_UUID}', id FROM family_members"
    )

    # Step 13: Drop old unique constraint on categories.name
    op.drop_constraint('categories_name_key', 'categories', type_='unique')

    # Step 14: Add composite unique constraint (name, project_id)
    op.create_unique_constraint('uq_category_name_project', 'categories', ['name', 'project_id'])

    # Step 15: Create composite index on tickets (project_id, purchased_at)
    op.create_index('ix_tickets_project_id_purchased_at', 'tickets', ['project_id', 'purchased_at'])

    # Step 16: Add nullable project_id to payments
    op.add_column('payments', sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=True))

    # Step 17: Backfill payments
    op.execute(f"UPDATE payments SET project_id = '{PORTUGAL_UUID}' WHERE project_id IS NULL")

    # Step 18: Set payments.project_id NOT NULL
    op.alter_column('payments', 'project_id', nullable=False)


def downgrade() -> None:
    # Reverse step 18
    op.alter_column('payments', 'project_id', nullable=True)

    # Reverse step 16
    op.drop_column('payments', 'project_id')

    # Reverse step 15
    op.drop_index('ix_tickets_project_id_purchased_at', table_name='tickets')

    # Reverse step 14
    op.drop_constraint('uq_category_name_project', 'categories', type_='unique')

    # Reverse step 13
    op.create_unique_constraint('categories_name_key', 'categories', ['name'])

    # Reverse step 11 (drops project_members)
    op.drop_table('project_members')

    # Reverse steps 9-10 (make nullable again for drop)
    op.alter_column('tickets', 'project_id', nullable=True)
    op.alter_column('categories', 'project_id', nullable=True)

    # Reverse steps 3-5 (drop columns)
    op.drop_column('tickets', 'project_id')
    op.drop_column('categories', 'project_id')
    op.drop_column('app_users', 'project_id')

    # Reverse step 1 (drops table + index)
    op.drop_index('ix_projects_status', table_name='projects')
    op.drop_table('projects')
