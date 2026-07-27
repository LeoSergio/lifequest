"""Make sync tables' primary key composite (id, user_id)

Antes desta migration, a PK das tabelas sincronizáveis era só `id`
(String). Como o frontend gerava ids sequenciais locais (1, 2, 3...)
por dispositivo via `++id` do Dexie, dois usuários diferentes podiam
ter registros com o mesmo `id`, e o segundo INSERT falhava com erro de
chave duplicada (ou, se fosse o mesmo usuário em dois dispositivos,
um registro sobrescrevia o outro).

O frontend agora gera um UUID por registro, o que já evita colisões
novas. Esta migration é uma defesa extra: torna (id, user_id) a chave
primária, então mesmo ids repetidos entre usuários diferentes (dados
antigos já existentes) deixam de colidir no banco.

Revision ID: ab3be94ca329
Revises: c1b2d3e4f5a6
Create Date: 2026-07-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'ab3be94ca329'
down_revision: Union[str, None] = 'c1b2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Todas as tabelas que herdam de SyncBase (id + user_id).
SYNC_TABLES = [
    "habits",
    "habit_completions",
    "goals",
    "daily_quests",
    "exercises",
    "workout_plans",
    "workout_plan_exercises",
    "workout_sessions",
    "session_sets",
    "pantry_items",
    "body_measurements",
    "inventory",
    "unlocked_achievements",
]


def upgrade() -> None:
    for table in SYNC_TABLES:
        op.drop_constraint(f"{table}_pkey", table, type_="primary")
        op.create_primary_key(f"{table}_pkey", table, ["id", "user_id"])


def downgrade() -> None:
    for table in SYNC_TABLES:
        op.drop_constraint(f"{table}_pkey", table, type_="primary")
        op.create_primary_key(f"{table}_pkey", table, ["id"])
