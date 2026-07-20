"""
Use Case: Sugerir até 3 refeições com base na dispensa, treino do dia e meta calórica.

Responsabilidade: montar os prompts e interpretar a resposta da IA.
Sem lógica de HTTP, banco ou provedor específico de IA.
"""
from app.domain.entities.ai_entities import PantryItemEntity
from app.domain.repositories.ai_provider_interface import AIProviderInterface

_GOAL_HINTS = {
    "ganho_peso": "Priorize refeições calóricas e ricas em proteína para ganho de massa.",
    "emagrecimento": "Priorize refeições com baixo teor calórico e alta saciedade.",
    "hipertrofia": "Priorize alto teor de proteína e calorias moderadas a altas.",
    "manutencao": "Priorize equilíbrio calórico e variedade nutricional.",
}

_SYSTEM_PROMPT = """\
Você é um assistente de nutrição de um app de saúde chamado LifeQuest.
Seu papel é sugerir refeições personalizadas com base na dispensa do usuário, no treino que ele fez hoje e na sua meta calórica diária.

REGRAS OBRIGATÓRIAS:
1. Sugira EXATAMENTE 3 opções de refeição diferentes.
2. Priorize ingredientes que o usuário JÁ TEM na dispensa.
3. Adapte as sugestões ao treino do dia: se ele treinou pesado (ex: pernas, costas, peito), sugira mais proteína; se foi cardio leve, leveza calórica.
4. Respeite a meta calórica informada para ESSE tipo de refeição (não para o dia todo).
5. Responda SOMENTE em JSON válido, exatamente neste schema:
{{
  "suggestions": [
    {{
      "title": "Nome da refeição",
      "description": "Breve descrição apetitosa (1 frase)",
      "ingredients_used": ["lista", "de", "itens", "da", "dispensa", "usados"],
      "ingredients_to_buy": ["lista", "de", "itens", "extras", "opcionais"],
      "estimated_calories": 450,
      "protein_g": 35,
      "prep_time_min": 20
    }}
  ]
}}

{goal_hint}
"""


async def suggest_meals(
    pantry_items: list[PantryItemEntity],
    meal_type: str,
    calorie_target: int | None,
    todays_workout: str | None,
    goal: str,
    ai_provider: AIProviderInterface,
) -> dict:
    system_prompt = _SYSTEM_PROMPT.format(goal_hint=_GOAL_HINTS.get(goal, ""))

    pantry_str = ", ".join(
        f"{i.name} ({i.quantity})" if i.quantity else i.name
        for i in pantry_items
    ) or "Dispensa vazia (sugira algo com ingredientes básicos comuns)"

    parts = [
        f"Tipo de refeição solicitada: {meal_type}.",
        f"Itens disponíveis na dispensa: {pantry_str}.",
        f"Objetivo do usuário: {goal}.",
    ]
    if calorie_target:
        parts.append(f"Meta calórica aproximada para ESTA refeição: {calorie_target} kcal.")
    if todays_workout:
        parts.append(f"Treino realizado hoje: {todays_workout}.")
    else:
        parts.append("Hoje não há treino registrado — sugira algo mais leve.")

    user_prompt = " ".join(parts)

    data = await ai_provider.generate_json(system_prompt, user_prompt)
    return data
