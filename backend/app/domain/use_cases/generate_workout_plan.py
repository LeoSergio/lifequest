"""
Use Case: Gerar uma ficha de treino completa a partir do objetivo do usuário.

A IA retorna um plano com nome e lista de exercícios já estruturados,
prontos para serem criados no banco do frontend.
"""
from app.domain.entities.ai_entities import (
    WorkoutPlanGenerationRequest,
    WorkoutPlanGenerationEntity,
)
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = (
    "Você é um personal trainer expert em musculação. "
    "Responda SOMENTE em JSON válido, seguindo exatamente este schema: "
    "{ \"plan_name\": string, \"exercises\": [ { \"name\": string, \"muscle_group\": string, "
    "\"equipment\": string, \"sets\": int, \"rest_seconds\": int } ], \"rationale\": string }. "
    "Regras importantes: "
    "1. Gere entre 4 e 8 exercícios por ficha. "
    "2. O campo 'muscle_group' deve ser um dos seguintes (em português): "
    "Peito, Costas, Bíceps, Tríceps, Pernas, Ombro, Core. "
    "3. O campo 'equipment' deve ser um dos seguintes: "
    "Peso livre, Máquina, Barra, Halteres, Peso corporal. "
    "4. Adapte o volume e intensidade ao nível do usuário. "
    "5. Não inclua campos extras no JSON."
)


async def generate_workout_plan(
    request: WorkoutPlanGenerationRequest,
    ai_provider: AIProviderInterface,
) -> WorkoutPlanGenerationEntity:
    equipment_list = ", ".join(request.equipment) if request.equipment else "peso corporal"
    user_prompt = (
        f"Objetivo: {request.goal}. "
        f"Equipamentos disponíveis: {equipment_list}. "
        f"Nível do aluno: {request.level}. "
        f"Frequência desejada: {request.days_per_week} dias por semana. "
        f"Duração estimada da sessão: {request.session_duration_min} minutos. "
        "Monte uma ficha com exercícios balanceados para atingir esse objetivo."
    )

    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    return WorkoutPlanGenerationEntity(**data)
