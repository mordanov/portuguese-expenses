"""add can_pay and is_kid flags to family_members

Revision ID: 008
Revises: 007
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("family_members", sa.Column("can_pay", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("family_members", sa.Column("is_kid", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("family_members", "is_kid")
    op.drop_column("family_members", "can_pay")
