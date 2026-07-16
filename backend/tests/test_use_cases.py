import pytest
from app.domain.entities.ai_entities import PantryItemEntity
from app.domain.use_cases.generate_recipe import generate_recipe
from app.domain.repositories.ai_provider_interface import AIProviderInterface

class FakeAIProvider(AIProviderInterface):
    """Um provedor falso para testes que não bate na internet"""
    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        # Apenas retornamos uma resposta estática para ver se o Use Case
        # processa e retorna a Entidade (RecipeEntity) corretamente.
        return {
            "title": "Omelete Maromba",
            "ingredients_used": ["Ovos", "Frango"],
            "ingredients_missing": ["Sal"],
            "calories": 300,
            "protein_g": 30,
            "instructions": "Misture tudo e frite."
        }

@pytest.mark.asyncio
async def test_generate_recipe_use_case():
    # 1. Prepara os dados de entrada
    fake_provider = FakeAIProvider()
    items = [
        PantryItemEntity(name="Ovos", quantity="12"),
        PantryItemEntity(name="Frango", quantity="500g")
    ]
    
    # 2. Executa o Use Case
    recipe = await generate_recipe(
        pantry_items=items,
        goal="hipertrofia",
        meal_type="almoço",
        ai_provider=fake_provider
    )
    
    # 3. Verifica se a arquitetura converteu pra entidade corretamente
    assert recipe.title == "Omelete Maromba"
    assert recipe.protein_g == 30
    assert len(recipe.ingredients_used) == 2
