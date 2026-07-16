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
