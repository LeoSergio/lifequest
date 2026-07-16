"""
Use Case: Calibrar a carga/volume de um exercício com base no feedback da última sessão.
"""
from app.domain.entities.ai_entities import WorkoutCalibrationRequest, WorkoutCalibrationEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = (
    "Você é um personal trainer. Responda SOMENTE em JSON, schema: "
    "{suggested_sets, suggested_reps, suggested_weight_kg, rationale}. "
    "Ajuste a próxima sessão com base no feedback do usuário sobre a sessão anterior."
)


async def calibrate_workout(
    request: WorkoutCalibrationRequest,
    ai_provider: AIProviderInterface,
) -> WorkoutCalibrationEntity:
    user_prompt = (
        f"Exercício: {request.exercise_name}. Feedback da última sessão: {request.last_feedback}. "
        f"Séries atuais: {request.current_sets}, reps atuais: {request.current_reps}, "
        f"carga atual: {request.current_weight_kg} kg."
    )

    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    return WorkoutCalibrationEntity(**data)
