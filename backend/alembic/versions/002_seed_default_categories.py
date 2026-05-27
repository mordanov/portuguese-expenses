"""002_seed_default_categories

Revision ID: 002
Revises: 001
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

DEFAULT_CATEGORIES = [
    ("Wine", "#722F37"),
    ("Meals", "#4CAF50"),
    ("Entertainment", "#2196F3"),
    ("Gifts", "#E91E63"),
    ("Parking", "#FF9800"),
    ("Other", "#9E9E9E"),
]


def upgrade() -> None:
    connection = op.get_bind()
    for name, color in DEFAULT_CATEGORIES:
        connection.execute(
            sa.text(
                "INSERT INTO categories (id, name, color, created_at) "
                "VALUES (gen_random_uuid(), :name, :color, NOW()) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {"name": name, "color": color},
        )


def downgrade() -> None:
    connection = op.get_bind()
    names = [name for name, _ in DEFAULT_CATEGORIES]
    connection.execute(sa.text("DELETE FROM categories WHERE name = ANY(:names)"), {"names": names})
