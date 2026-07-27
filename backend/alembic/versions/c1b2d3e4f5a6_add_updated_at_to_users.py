"""Add updated_at to users table

Revision ID: c1b2d3e4f5a6
Revises: 5e95a34d30ff
Create Date: 2026-07-27 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'c1b2d3e4f5a6'
down_revision: Union[str, None] = '5e95a34d30ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona updated_at à tabela users para permitir pull incremental do player.
    # server_default=now() para que rows existentes já tenham um valor válido.
    op.add_column('users',
        sa.Column(
            'updated_at', 
            sa.DateTime(), 
            nullable=False, 
            server_default=sa.text('NOW()')
        )
    )


def downgrade() -> None:
    op.drop_column('users', 'updated_at')
