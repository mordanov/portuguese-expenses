"""001_initial_schema

Revision ID: 001
Revises:
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "family_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("name", name="uq_family_members_name"),
    )

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("name", name="uq_categories_name"),
    )

    op.create_table(
        "app_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("username", name="uq_app_users_username"),
    )

    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_name", sa.String(200), nullable=False),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("family_members.id"), nullable=False),
        sa.Column("raw_image_url", sa.Text, nullable=True),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("discount_total", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("total_price >= 0", name="ck_tickets_total_price_non_negative"),
        sa.CheckConstraint("discount_total >= 0", name="ck_tickets_discount_total_non_negative"),
    )
    op.create_index("ix_tickets_purchased_at", "tickets", ["purchased_at"])
    op.create_index("ix_tickets_paid_by_id", "tickets", ["paid_by_id"])

    op.create_table(
        "items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tickets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("discounted_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("position", sa.SmallInteger, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("price >= 0", name="ck_items_price_non_negative"),
        sa.CheckConstraint("discounted_price >= 0", name="ck_items_discounted_price_non_negative"),
    )
    op.create_index("ix_items_ticket_id", "items", ["ticket_id"])
    op.create_index("ix_items_category_id", "items", ["category_id"])

    op.create_table(
        "allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("family_members.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("item_id", "member_id", name="uq_allocation_item_member"),
    )
    op.create_index("ix_allocations_item_id", "allocations", ["item_id"])
    op.create_index("ix_allocations_member_id", "allocations", ["member_id"])


def downgrade() -> None:
    op.drop_table("allocations")
    op.drop_table("items")
    op.drop_table("tickets")
    op.drop_table("app_users")
    op.drop_table("categories")
    op.drop_table("family_members")
