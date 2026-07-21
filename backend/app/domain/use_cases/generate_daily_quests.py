"""
Use Case: Gerar 3 missões diárias personalizadas para o jogador baseadas no seu nível.
"""
from app.domain.entities.ai_entities import DailyQuestsRequest, DailyQuestsResponseEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = """
Você é o Mestre de Jogo de um aplicativo de produtividade e saúde chamado LifeQuest.
O jogador logou hoje e precisa de 3 Missões Diárias rápidas e práticas.
Cada missão deve pertencer a um pilar diferente (ex: "saude", "foco", "lar", "social").

Regras:
1. As missões devem ser alcançáveis no mesmo dia.
2. Seja criativo nos títulos, usando tema de RPG (ex: "O Elixir da Vida" para beber água).
3. Adapte a recompensa de XP com base no nível do jogador. Para nível 1, 10 a 20 XP. Para níveis altos, 50 a 100 XP.

Retorne SOMENTE em formato JSON com o seguinte schema exato:
{
  "quests": [
    {
      "id": "string (ex: quest_agua)",
      "pillar": "string",
      "title": "string",
      "description": "string",
      "xp_reward": int
    }
  ]
}
"""


async def generate_daily_quests(
    request: DailyQuestsRequest,
    ai_provider: AIProviderInterface,
) -> dict:
    areas = ", ".join(request.focus_areas) if request.focus_areas else "variadas"
    
    user_prompt = (
        f"Gere 3 missões diárias para um jogador de Nível {request.player_level}. "
        f"Áreas de foco preferidas: {areas}."
    )

    # Chamamos o provider. O retorno já será um dicionário parseado do JSON.
    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    
    # Validamos e retornamos
    entity = DailyQuestsResponseEntity(**data)
    return entity.model_dump()
