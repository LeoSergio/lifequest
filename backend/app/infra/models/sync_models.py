from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, Float, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from uuid import UUID, uuid4

from app.infra.database import Base


class SyncBase(Base):
    """
    Classe base abstrata para todos os modelos que serão sincronizados.
    Garante que todos tenham os campos necessários para o Sync Queue (Local-First).
    """
    __abstract__ = True

    # O frontend agora gera um UUID (crypto.randomUUID()) no cliente para todo
    # registro novo, então colisões entre dispositivos/usuários deixam de
    # acontecer na prática. Ainda assim, mantemos a chave primária composta
    # com (id, user_id) — e não só `id` — como defesa em profundidade: mesmo
    # que dois registros de usuários diferentes acabem com o mesmo `id`
    # (ex.: dados antigos já gravados com ids sequenciais 1, 2, 3...), eles
    # não colidem mais no banco, porque o par (id, user_id) continua único.
    id: Mapped[str] = mapped_column(String, primary_key=True)

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), primary_key=True, index=True
    )
    
    # Controle de Sincronização (Soft Delete e Auditoria)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


# ==========================================
# 1. Hábitos e Metas
# ==========================================
class HabitModel(SyncBase):
    __tablename__ = "habits"

    title: Mapped[str] = mapped_column(String)
    icon: Mapped[str] = mapped_column(String, nullable=True)
    cadence: Mapped[str] = mapped_column(String) # 'daily', 'weekly'
    weekly_target: Mapped[int] = mapped_column(Integer, nullable=True)
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    archived_at: Mapped[str] = mapped_column(String, nullable=True)

class HabitCompletionModel(SyncBase):
    __tablename__ = "habit_completions"

    habit_id: Mapped[str] = mapped_column(String, index=True)
    date: Mapped[str] = mapped_column(String) # ISO YYYY-MM-DD

class GoalModel(SyncBase):
    __tablename__ = "goals"

    title: Mapped[str] = mapped_column(String)
    target_value: Mapped[float] = mapped_column(Float)
    current_value: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str] = mapped_column(String)
    reward: Mapped[str] = mapped_column(String, nullable=True)
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    deadline: Mapped[str] = mapped_column(String) # ISO YYYY-MM-DD
    achieved_at: Mapped[str] = mapped_column(String, nullable=True)
    is_epic: Mapped[bool] = mapped_column(Boolean, default=False)

class DailyQuestModel(SyncBase):
    __tablename__ = "daily_quests"

    date: Mapped[str] = mapped_column(String, index=True)
    pillar: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, nullable=True)
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)


# ==========================================
# 2. Treinos (Academia)
# ==========================================
class ExerciseModel(SyncBase):
    __tablename__ = "exercises"

    name: Mapped[str] = mapped_column(String)
    muscle_group: Mapped[str] = mapped_column(String, nullable=True)
    equipment: Mapped[str] = mapped_column(String, nullable=True)

class WorkoutPlanModel(SyncBase):
    __tablename__ = "workout_plans"

    name: Mapped[str] = mapped_column(String)
    weekday: Mapped[str] = mapped_column(String, nullable=True) # JSON array of days saved as string or JSONB
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=True)

class WorkoutPlanExerciseModel(SyncBase):
    __tablename__ = "workout_plan_exercises"

    workout_plan_id: Mapped[str] = mapped_column(String, index=True)
    exercise_id: Mapped[str] = mapped_column(String, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    target_sets: Mapped[int] = mapped_column(Integer, default=3)
    target_reps: Mapped[str] = mapped_column(String, nullable=True)
    rest_seconds: Mapped[int] = mapped_column(Integer, default=60)

class WorkoutSessionModel(SyncBase):
    __tablename__ = "workout_sessions"

    workout_plan_id: Mapped[str] = mapped_column(String, index=True, nullable=True)
    started_at: Mapped[str] = mapped_column(String)
    finished_at: Mapped[str] = mapped_column(String, nullable=True)
    is_rest_day: Mapped[bool] = mapped_column(Boolean, default=False)

class SessionSetModel(SyncBase):
    __tablename__ = "session_sets"

    workout_session_id: Mapped[str] = mapped_column(String, index=True)
    workout_plan_exercise_id: Mapped[str] = mapped_column(String, index=True)
    exercise_id: Mapped[str] = mapped_column(String, index=True)
    set_number: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=True)
    reps_done: Mapped[int] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[str] = mapped_column(String, nullable=True)


# ==========================================
# 3. Nutrição e Inventário
# ==========================================
class PantryItemModel(SyncBase):
    __tablename__ = "pantry_items"

    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, nullable=True)
    quantity: Mapped[str] = mapped_column(String, nullable=True)

class BodyMeasurementModel(SyncBase):
    __tablename__ = "body_measurements"

    date: Mapped[str] = mapped_column(String, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=True)
    weight: Mapped[float] = mapped_column(Float, nullable=True)
    height: Mapped[float] = mapped_column(Float, nullable=True)
    shoulder: Mapped[float] = mapped_column(Float, nullable=True)
    chest: Mapped[float] = mapped_column(Float, nullable=True)
    abdomen: Mapped[float] = mapped_column(Float, nullable=True)
    thigh: Mapped[float] = mapped_column(Float, nullable=True)
    calf: Mapped[float] = mapped_column(Float, nullable=True)
    arm_left: Mapped[float] = mapped_column(Float, nullable=True)
    arm_right: Mapped[float] = mapped_column(Float, nullable=True)
    forearm: Mapped[float] = mapped_column(Float, nullable=True)
    body_fat_percent: Mapped[float] = mapped_column(Float, nullable=True)

class InventoryModel(SyncBase):
    __tablename__ = "inventory"

    item_id: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    purchased_at: Mapped[str] = mapped_column(String)

class UnlockedAchievementModel(SyncBase):
    __tablename__ = "unlocked_achievements"

    achievement_id: Mapped[str] = mapped_column(String)
    unlocked_at: Mapped[str] = mapped_column(String)


# ==========================================
# 5. Social — Amizades
# ==========================================
class FriendshipModel(Base):
    """
    Representa uma solicitação/amizade entre dois usuários.
    A amizade é direcional no banco (requester → addressee) mas
    a query de amigos aceitos busca nas duas direções.
    status: 'pending' | 'accepted' | 'blocked'
    """
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_no_self_friendship"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    requester_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    addressee_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | blocked
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
