"""unique constraint on offset_rules (project_id, person_a_id, person_b_id)

Revision ID: 014_offset_rules_unique
Revises: 013_offset_rules_project
Create Date: 2026-07-19
"""
from alembic import op

revision = '014_offset_rules_unique'
down_revision = '013_offset_rules_project'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_offset_rules_project_persons',
        'offset_rules',
        ['project_id', 'person_a_id', 'person_b_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_offset_rules_project_persons', 'offset_rules', type_='unique')
