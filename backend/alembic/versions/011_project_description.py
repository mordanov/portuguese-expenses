"""add description column to projects

Revision ID: 011_project_description
Revises: 010_multi_project_support
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa

revision = '011_project_description'
down_revision = '010_multi_project_support'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('description', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'description')
