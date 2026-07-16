"""
Use Case: Gerar uma missão personalizada para o jogador.
"""
from app.domain.entities.ai_entities import MissionRequest, MissionEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = (
    "Você é um mestre de jogo de um RPG de gestão doméstica. Responda SOMENTE em JSON, "
    "schema: {title, description, difficulty, xp_reward}. "
    "Se recent_failures for alto, reduza a exigência da missão em vez de punir o jogador."
)


async def generate_mission(
    request: MissionRequest,
    ai_provider: AIProviderInterface,
) -> MissionEntity:
    user_prompt = (
        f"Pilar: {request.pillar}. Nível do jogador: {request.player_level}. "
        f"Falhas recentes nesse tipo de missão: {request.recent_failures}."
    )

    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    return MissionEntity(**data)
