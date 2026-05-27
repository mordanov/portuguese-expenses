"""004_offset_rules

Revision ID: 004
Revises: 003
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "offset_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("person_a_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("person_b_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["person_a_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["person_b_id"], ["family_members.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("offset_rules")
