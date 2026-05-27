"""003_seed_app_users

Revision ID: 003
Revises: 002
Create Date: 2026-05-27
"""

import os

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def _hash_password(plain: str) -> str:
    import bcrypt

    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def upgrade() -> None:
    connection = op.get_bind()
    users = [
        (
            os.environ.get("APP_USER_1_USERNAME", "user1"),
            os.environ.get("APP_USER_1_PASSWORD", "password1"),
        ),
        (
            os.environ.get("APP_USER_2_USERNAME", "user2"),
            os.environ.get("APP_USER_2_PASSWORD", "password2"),
        ),
    ]
    for username, password in users:
        password_hash = _hash_password(password)
        connection.execute(
            sa.text(
                "INSERT INTO app_users (id, username, password_hash, created_at) "
                "VALUES (gen_random_uuid(), :username, :password_hash, NOW()) "
                "ON CONFLICT (username) DO NOTHING"
            ),
            {"username": username, "password_hash": password_hash},
        )


def downgrade() -> None:
    connection = op.get_bind()
    usernames = [
        os.environ.get("APP_USER_1_USERNAME", "user1"),
        os.environ.get("APP_USER_2_USERNAME", "user2"),
    ]
    connection.execute(sa.text("DELETE FROM app_users WHERE username = ANY(:usernames)"), {"usernames": usernames})
