from pydantic import BaseModel


class PantryItem(BaseModel):
    name: str
    category: str | None = None
    quantity: str | None = None


class RecipeRequest(BaseModel):
    pantry_items: list[PantryItem]
    goal: str  # hipertrofia | emagrecimento | manutencao | ganho_peso
    meal_type: str | None = None


class RecipeResponse(BaseModel):
    title: str
    ingredients_used: list[str]
    ingredients_missing: list[str]
    calories: int
    protein_g: int
    instructions: str


class MissionRequest(BaseModel):
    pillar: str  # lar | academia | disciplina | social
    player_level: int
    recent_failures: int = 0


class MissionResponse(BaseModel):
    title: str
    description: str
    difficulty: str
    xp_reward: int


class WorkoutCalibrationRequest(BaseModel):
    exercise_name: str
    last_feedback: str  # facil | ideal | muito_dificil
    current_sets: int
    current_reps: str
    current_weight_kg: float | None = None


class WorkoutCalibrationResponse(BaseModel):
    suggested_sets: int
    suggested_reps: str
    suggested_weight_kg: float | None = None
    rationale: str
