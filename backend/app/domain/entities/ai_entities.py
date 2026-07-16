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
