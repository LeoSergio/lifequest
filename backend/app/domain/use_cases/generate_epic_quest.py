"""
Use Case: Gerar uma Missão Épica (Boss Fight mensal) para o jogador.
"""
from app.domain.entities.ai_entities import EpicQuestRequest, EpicQuestEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = """
Você é o Mestre de Jogo de um aplicativo de produtividade e saúde chamado LifeQuest.
Gere 1 Missão Épica (um Chefão) que demore de 15 a 30 dias para ser concluída.
Deve ser um desafio significativo de desenvolvimento pessoal, saúde ou foco.
Exemplos: "Ler 300 páginas de um livro", "Meditar por 30 dias seguidos", "Correr 50km no mês".

Retorne SOMENTE em formato JSON com o seguinte schema exato:
{
  "title": "string (O nome do Chefão/Missão. Ex: O Dragão da Procrastinação - Ler 1 Livro)",
  "description": "string (Uma breve lore épica sobre o desafio)",
  "target_value": int (O valor numérico total a ser alcançado. Ex: 300 para páginas, ou 30 para dias)",
  "unit": "string (A unidade de medida. Ex: páginas, dias, km)",
  "xp_reward": int (Alta recompensa, entre 500 e 1500 dependendo do nível),
  "deadline_days": int (Quantos dias o jogador tem. Ex: 30)
}
"""


async def generate_epic_quest(
    request: EpicQuestRequest,
    ai_provider: AIProviderInterface,
) -> dict:
    user_prompt = f"Gere uma Missão Épica desafiadora para um jogador de Nível {request.player_level}."

    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    
    entity = EpicQuestEntity(**data)
    return entity.model_dump()
