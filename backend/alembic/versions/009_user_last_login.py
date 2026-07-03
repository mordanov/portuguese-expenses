"""add last_login_at to app_users

Revision ID: 009_user_last_login
Revises: 008_member_flags
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '009_user_last_login'
down_revision = '008_member_flags'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('app_users', 'last_login_at')
