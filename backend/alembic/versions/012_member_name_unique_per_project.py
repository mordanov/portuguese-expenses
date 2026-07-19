"""make family_member name unique per project instead of globally

Revision ID: 012_member_name_unique_per_project
Revises: 011_project_description
Create Date: 2026-07-19
"""
from alembic import op

revision = '012_member_name_unique_per_project'
down_revision = '011_project_description'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('uq_family_members_name', 'family_members', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('uq_family_members_name', 'family_members', ['name'])
