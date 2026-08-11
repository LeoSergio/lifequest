"""
Entidades de domínio puras — sem dependência de HTTP, banco ou providers externos.
Representam os conceitos de negócio do LifeQuest que transitam pela camada de IA.
"""
from pydantic import BaseModel


# ---------- Despensa / Receitas ----------

class PantryItemEntity(BaseModel):
    name: str
    category: str | None = None
    quantity: str | None = None


class RecipeEntity(BaseModel):
    title: str
    ingredients_used: list[str]
    ingredients_missing: list[str]
    calories: int
    protein_g: int
    instructions: str


# ---------- Onboarding / Arquétipo ----------

class OnboardingAnswers(BaseModel):
    answers: dict[str, str]


class InitialMissionEntity(BaseModel):
    pillar: str   # lar | academia | disciplina | social
    title: str
    description: str
    xp_reward: int


class ArchetypeEntity(BaseModel):
    archetype: str
    archetype_description: str
    initial_missions: list[InitialMissionEntity]


# ---------- Missões ----------

class MissionRequest(BaseModel):
    pillar: str   # lar | academia | disciplina | social
    player_level: int
    recent_failures: int = 0


class MissionEntity(BaseModel):
    title: str
    description: str
    difficulty: str
    xp_reward: int


class DailyQuestEntity(BaseModel):
    id: str  # Ex: q_saude, q_foco, q_lar
    pillar: str
    title: str
    description: str
    xp_reward: int


class DailyQuestsRequest(BaseModel):
    player_level: int
    focus_areas: list[str] = []
    recent_quest_titles: list[str] = []  # títulos de missões recentes para evitar repetição


class DailyQuestsResponseEntity(BaseModel):
    quests: list[DailyQuestEntity]


class EpicQuestRequest(BaseModel):
    player_level: int


class EpicQuestEntity(BaseModel):
    title: str
    description: str
    target_value: float
    unit: str
    xp_reward: int
    deadline_days: int


# ---------- Calibração de Treino ----------

class WorkoutCalibrationRequest(BaseModel):
    exercise_name: str
    last_feedback: str   # facil | ideal | muito_dificil
    current_sets: int
    current_reps: str
    current_weight_kg: float | None = None


class WorkoutCalibrationEntity(BaseModel):
    suggested_sets: int
    suggested_reps: str
    suggested_weight_kg: float | None = None
    rationale: str


# ---------- Geração de Ficha de Treino ----------

class GeneratedExerciseEntity(BaseModel):
    name: str
    muscle_group: str
    equipment: str
    sets: int
    rest_seconds: int


class WorkoutPlanGenerationRequest(BaseModel):
    goal: str                    # ex: "hipertrofia de peito e tríceps"
    equipment: list[str]         # ex: ["barra", "halteres"]
    level: str                   # iniciante | intermediario | avancado
    days_per_week: int           # ex: 3
    session_duration_min: int    # ex: 60


class WorkoutPlanGenerationEntity(BaseModel):
    plan_name: str
    exercises: list[GeneratedExerciseEntity]
    rationale: str
