"""
Use Case: Gerar receita a partir dos itens disponíveis na despensa.

Responsabilidade: montar os prompts e interpretar a resposta da IA.
Não sabe nada sobre HTTP, banco de dados ou qual provedor de IA está sendo usado.
"""
from app.domain.entities.ai_entities import PantryItemEntity, RecipeEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_GOAL_PROMPTS = {
    "ganho_peso": "Priorize uma combinação calórica e rica em proteína.",
    "emagrecimento": "Priorize baixo teor calórico e alta saciedade.",
    "hipertrofia": "Priorize alto teor de proteína e calorias moderadas a altas.",
    "manutencao": "Priorize equilíbrio calórico e variedade nutricional.",
}

_SYSTEM_PROMPT = (
    "Você é um assistente de nutrição. Responda SOMENTE em JSON válido, "
    "seguindo exatamente o schema: {{title, ingredients_used[], ingredients_missing[], "
    "calories, protein_g, instructions}}. Priorize receitas simples de preparar em casa. "
    "{goal_hint}"
)


async def generate_recipe(
    pantry_items: list[PantryItemEntity],
    goal: str,
    meal_type: str | None,
    ai_provider: AIProviderInterface,
) -> RecipeEntity:
    system_prompt = _SYSTEM_PROMPT.format(goal_hint=_GOAL_PROMPTS.get(goal, ""))

    items = ", ".join(
        f"{i.name} ({i.quantity})" if i.quantity else i.name
        for i in pantry_items
    )
    user_prompt = f"Itens disponíveis na despensa: {items}. Objetivo do usuário: {goal}."
    if meal_type:
        user_prompt += f" Tipo de refeição desejada: {meal_type}."

    data = await ai_provider.generate_json(system_prompt, user_prompt)
    return RecipeEntity(**data)
