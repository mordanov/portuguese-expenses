"""add project_id to offset_rules

Revision ID: 013_offset_rules_project
Revises: 012_member_name_per_project
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '013_offset_rules_project'
down_revision = '012_member_name_per_project'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('offset_rules', sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE offset_rules SET project_id = (
            SELECT id FROM projects ORDER BY created_at LIMIT 1
        ) WHERE project_id IS NULL
    """)
    op.alter_column('offset_rules', 'project_id', nullable=False)
    op.create_foreign_key(
        'fk_offset_rules_project_id', 'offset_rules', 'projects',
        ['project_id'], ['id'], ondelete='CASCADE',
    )
    op.create_index('ix_offset_rules_project_id', 'offset_rules', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_offset_rules_project_id', 'offset_rules')
    op.drop_constraint('fk_offset_rules_project_id', 'offset_rules', type_='foreignkey')
    op.drop_column('offset_rules', 'project_id')
