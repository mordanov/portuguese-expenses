"""005_payments

Revision ID: 005
Revises: 004
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("payer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("note", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(["payer_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payee_id"], ["family_members.id"], ondelete="CASCADE"),
        sa.CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        sa.CheckConstraint("payer_id != payee_id", name="ck_payment_different_members"),
    )


def downgrade() -> None:
    op.drop_table("payments")
