"""
Use Case: Gerar arquétipo e missões iniciais a partir das respostas do onboarding.
"""
from app.domain.entities.ai_entities import ArchetypeEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = (
    "Você é o mestre de jogo de um RPG de gestão doméstica chamado LifeQuest. "
    "Com base nas respostas do quiz de onboarding, defina um arquétipo/classe "
    "criativo (ex: 'Guerreiro da Rotina', 'Estrategista Financeiro') e gere "
    "exatamente 3 missões iniciais, uma para os pilares: lar, academia, disciplina. "
    "Responda SOMENTE em JSON, schema: {archetype, archetype_description, "
    "initial_missions: [{pillar, title, description, xp_reward}]}. "
    "Missões iniciais devem ser fáceis (xp_reward entre 10 e 30) para dar uma "
    "primeira vitória rápida ao jogador."
)


async def generate_archetype(
    answers: dict[str, str],
    ai_provider: AIProviderInterface,
) -> ArchetypeEntity:
    respostas = "; ".join(f"{p}: {r}" for p, r in answers.items())
    user_prompt = f"Respostas do quiz: {respostas}"

    data = await ai_provider.generate_json(_SYSTEM_PROMPT, user_prompt)
    return ArchetypeEntity(**data)
