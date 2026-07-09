from fastapi import APIRouter

from app.ai_client import generate_json
from app.schemas import (
    MissionRequest,
    MissionResponse,
    RecipeRequest,
    RecipeResponse,
    WorkoutCalibrationRequest,
    WorkoutCalibrationResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])

GOAL_PROMPTS = {
    "ganho_peso": "Priorize uma combinação calórica e rica em proteína.",
    "emagrecimento": "Priorize baixo teor calórico e alta saciedade.",
    "hipertrofia": "Priorize alto teor de proteína e calorias moderadas a altas.",
    "manutencao": "Priorize equilíbrio calórico e variedade nutricional.",
}


@router.post("/recipes/generate", response_model=RecipeResponse)
async def generate_recipe(payload: RecipeRequest):
    system_prompt = (
        "Você é um assistente de nutrição. Responda SOMENTE em JSON válido, "
        "seguindo exatamente o schema: {title, ingredients_used[], ingredients_missing[], "
        "calories, protein_g, instructions}. Priorize receitas simples de preparar em casa. "
        f"{GOAL_PROMPTS.get(payload.goal, '')}"
    )
    items = ", ".join(f"{i.name} ({i.quantity})" if i.quantity else i.name for i in payload.pantry_items)
    user_prompt = f"Itens disponíveis na despensa: {items}. Objetivo do usuário: {payload.goal}."
    if payload.meal_type:
        user_prompt += f" Tipo de refeição desejada: {payload.meal_type}."

    data = await generate_json(system_prompt, user_prompt)
    return RecipeResponse(**data)


@router.post("/missions/generate", response_model=MissionResponse)
async def generate_mission(payload: MissionRequest):
    system_prompt = (
        "Você é um mestre de jogo de um RPG de gestão doméstica. Responda SOMENTE em JSON, "
        "schema: {title, description, difficulty, xp_reward}. "
        "Se recent_failures for alto, reduza a exigência da missão em vez de punir o jogador."
    )
    user_prompt = (
        f"Pilar: {payload.pillar}. Nível do jogador: {payload.player_level}. "
        f"Falhas recentes nesse tipo de missão: {payload.recent_failures}."
    )
    data = await generate_json(system_prompt, user_prompt)
    return MissionResponse(**data)


@router.post("/workouts/calibrate", response_model=WorkoutCalibrationResponse)
async def calibrate_workout(payload: WorkoutCalibrationRequest):
    system_prompt = (
        "Você é um personal trainer. Responda SOMENTE em JSON, schema: "
        "{suggested_sets, suggested_reps, suggested_weight_kg, rationale}. "
        "Ajuste a próxima sessão com base no feedback do usuário sobre a sessão anterior."
    )
    user_prompt = (
        f"Exercício: {payload.exercise_name}. Feedback da última sessão: {payload.last_feedback}. "
        f"Séries atuais: {payload.current_sets}, reps atuais: {payload.current_reps}, "
        f"carga atual: {payload.current_weight_kg} kg."
    )
    data = await generate_json(system_prompt, user_prompt)
    return WorkoutCalibrationResponse(**data)
