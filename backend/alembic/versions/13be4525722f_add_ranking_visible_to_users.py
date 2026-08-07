"""add_ranking_visible_to_users

Revision ID: 13be4525722f
Revises: c65f4cd3d575
Create Date: 2026-08-07 13:58:31.413072

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13be4525722f'
down_revision: Union[str, None] = 'c65f4cd3d575'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('ranking_visible', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'ranking_visible')
