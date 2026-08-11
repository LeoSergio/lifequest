"""
Schemas HTTP (DTOs) da camada de adapter.

Diferença dos entities do domínio:
- Entities (domain/entities/) = contratos internos de negócio
- Schemas (adapters/http/schemas.py) = contratos externos da API HTTP

Para este projeto stateless, a maioria é idêntica — mas mantê-los separados
garante que mudanças no contrato HTTP não afetem o domínio e vice-versa.
"""
from pydantic import BaseModel


class PantryItemSchema(BaseModel):
    name: str
    category: str | None = None
    quantity: str | None = None


class RecipeRequestSchema(BaseModel):
    pantry_items: list[PantryItemSchema]
    goal: str  # hipertrofia | emagrecimento | manutencao | ganho_peso
    meal_type: str | None = None


class RecipeResponseSchema(BaseModel):
    title: str
    ingredients_used: list[str]
    ingredients_missing: list[str]
    calories: int
    protein_g: int
    instructions: str


class OnboardingRequestSchema(BaseModel):
    answers: dict[str, str]


class InitialMissionSchema(BaseModel):
    pillar: str
    title: str
    description: str
    xp_reward: int


class OnboardingResponseSchema(BaseModel):
    archetype: str
    archetype_description: str
    initial_missions: list[InitialMissionSchema]


class MissionResponseSchema(BaseModel):
    title: str
    description: str
    difficulty: str
    xp_reward: int


class DailyQuestsRequestSchema(BaseModel):
    player_level: int
    focus_areas: list[str] = []
    recent_quest_titles: list[str] = []  # títulos recentes para evitar repetição


class DailyQuestItemSchema(BaseModel):
    id: str
    pillar: str
    title: str
    description: str
    xp_reward: int


class DailyQuestsResponseSchema(BaseModel):
    quests: list[DailyQuestItemSchema]


class EpicQuestRequestSchema(BaseModel):
    player_level: int


class EpicQuestResponseSchema(BaseModel):
    title: str
    description: str
    target_value: float
    unit: str
    xp_reward: int
    deadline_days: int


class WorkoutCalibrationRequestSchema(BaseModel):
    exercise_name: str
    last_feedback: str  # facil | ideal | muito_dificil
    current_sets: int
    current_reps: str
    current_weight_kg: float | None = None


class WorkoutCalibrationResponseSchema(BaseModel):
    suggested_sets: int
    suggested_reps: str
    suggested_weight_kg: float | None = None
    rationale: str


# ── Meal Suggestions ───────────────────────────────────────────────────────────

class MealSuggestionRequestSchema(BaseModel):
    pantry_items: list[PantryItemSchema]
    meal_type: str          # cafe_manha | almoco | janta | lanche
    goal: str               # hipertrofia | emagrecimento | manutencao | ganho_peso
    calorie_target: int | None = None
    todays_workout: str | None = None
    user_request: str | None = None    # Pedido livre do usuário, ex: "quero algo com carne"


class MealSuggestionItemSchema(BaseModel):
    title: str
    description: str
    ingredients_used: list[str]
    ingredients_to_buy: list[str]
    estimated_calories: int
    protein_g: int
    prep_time_min: int


class MealSuggestionResponseSchema(BaseModel):
    suggestions: list[MealSuggestionItemSchema]


# ── Workout Plan Generation ───────────────────────────────────────────────────────────

class WorkoutPlanGenerationRequestSchema(BaseModel):
    goal: str                    # ex: "hipertrofia de peito e tríceps"
    equipment: list[str] = []    # ex: ["barra", "halteres"]
    level: str = "intermediario" # iniciante | intermediario | avancado
    days_per_week: int = 3
    session_duration_min: int = 60


class GeneratedExerciseSchema(BaseModel):
    name: str
    muscle_group: str
    equipment: str
    sets: int
    rest_seconds: int


class WorkoutPlanGenerationResponseSchema(BaseModel):
    plan_name: str
    exercises: list[GeneratedExerciseSchema]
    rationale: str
