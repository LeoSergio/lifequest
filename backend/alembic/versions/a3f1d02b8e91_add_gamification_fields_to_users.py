"""add gamification fields to users

Revision ID: a3f1d02b8e91
Revises: 8c8182915226
Create Date: 2026-07-21 14:44:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1d02b8e91'
down_revision: Union[str, None] = '8c8182915226'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona as novas colunas de gamificação ao usuário.
    # server_default garante que usuários existentes já tenham um valor válido.
    op.add_column('users',
        sa.Column('streak_days', sa.Integer(), nullable=False, server_default='0')
    )
    op.add_column('users',
        sa.Column('last_active_date', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'last_active_date')
    op.drop_column('users', 'streak_days')
