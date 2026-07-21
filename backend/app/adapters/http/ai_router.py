"""
Adapter HTTP para as rotas de IA.

Responsabilidade ÚNICA: traduzir HTTP ↔ Use Cases.
- Recebe payload HTTP (schemas Pydantic)
- Chama o use case correto com os dados do domínio
- Devolve a resposta HTTP

Nenhuma lógica de negócio aqui — sem montagem de prompts, sem regras de fallback.
"""
from fastapi import APIRouter

from app.domain.entities.ai_entities import (
    MissionRequest,
    OnboardingAnswers,
    PantryItemEntity,
    WorkoutCalibrationRequest,
    DailyQuestsRequest,
    EpicQuestRequest,
)
from app.domain.use_cases import (
    calibrate_workout,
    generate_archetype,
    generate_mission,
    generate_recipe,
    suggest_meals,
    generate_daily_quests,
    generate_epic_quest,
)
from app.infra.ai_client import ai_provider
from app.adapters.http.schemas import (
    MissionResponseSchema,
    OnboardingRequestSchema,
    OnboardingResponseSchema,
    RecipeRequestSchema,
    RecipeResponseSchema,
    WorkoutCalibrationRequestSchema,
    WorkoutCalibrationResponseSchema,
    MealSuggestionRequestSchema,
    MealSuggestionResponseSchema,
    DailyQuestsRequestSchema,
    DailyQuestsResponseSchema,
    EpicQuestRequestSchema,
    EpicQuestResponseSchema,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/recipes/generate", response_model=RecipeResponseSchema)
async def generate_recipe_endpoint(payload: RecipeRequestSchema):
    items = [PantryItemEntity(**item.model_dump()) for item in payload.pantry_items]
    result = await generate_recipe.generate_recipe(
        pantry_items=items,
        goal=payload.goal,
        meal_type=payload.meal_type,
        ai_provider=ai_provider,
    )
    return result


@router.post("/onboarding/archetype", response_model=OnboardingResponseSchema)
async def generate_archetype_endpoint(payload: OnboardingRequestSchema):
    result = await generate_archetype.generate_archetype(
        answers=payload.answers,
        ai_provider=ai_provider,
    )
    return result


@router.post("/missions/generate", response_model=MissionResponseSchema)
async def generate_mission_endpoint(payload: MissionRequest):
    result = await generate_mission.generate_mission(
        request=payload,
        ai_provider=ai_provider,
    )
    return result


@router.post("/quests/daily", response_model=DailyQuestsResponseSchema)
async def generate_daily_quests_endpoint(payload: DailyQuestsRequestSchema):
    request_entity = DailyQuestsRequest(**payload.model_dump())
    result = await generate_daily_quests.generate_daily_quests(
        request=request_entity,
        ai_provider=ai_provider,
    )
    return result


@router.post("/quests/epic", response_model=EpicQuestResponseSchema)
async def generate_epic_quest_endpoint(payload: EpicQuestRequestSchema):
    request_entity = EpicQuestRequest(**payload.model_dump())
    result = await generate_epic_quest.generate_epic_quest(
        request=request_entity,
        ai_provider=ai_provider,
    )
    return result


@router.post("/workouts/calibrate", response_model=WorkoutCalibrationResponseSchema)
async def calibrate_workout_endpoint(payload: WorkoutCalibrationRequest):
    result = await calibrate_workout.calibrate_workout(
        request=payload,
        ai_provider=ai_provider,
    )
    return result


@router.post("/meals/suggest", response_model=MealSuggestionResponseSchema)
async def suggest_meals_endpoint(payload: MealSuggestionRequestSchema):
    """Retorna até 3 sugestões de refeição personalizadas com base na dispensa e treino do dia."""
    items = [PantryItemEntity(**item.model_dump()) for item in payload.pantry_items]
    data = await suggest_meals.suggest_meals(
        pantry_items=items,
        meal_type=payload.meal_type,
        calorie_target=payload.calorie_target,
        todays_workout=payload.todays_workout,
        goal=payload.goal,
        ai_provider=ai_provider,
        user_request=payload.user_request,
    )
    return MealSuggestionResponseSchema(**data)
