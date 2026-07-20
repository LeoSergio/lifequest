/**
 * Serviço de sugestões de refeição via IA.
 * Chama o backend LifeQuest em /ai/meals/suggest.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * @param {object} params
 * @param {Array}  params.pantryItems    - Itens da despensa [{name, category, quantity}]
 * @param {string} params.mealType       - cafe_manha | almoco | janta | lanche
 * @param {string} params.goal           - hipertrofia | emagrecimento | manutencao | ganho_peso
 * @param {number|null} params.calorieTarget - Meta calórica para essa refeição
 * @param {string|null} params.todaysWorkout - Ex: "Peito e Tríceps"
 * @returns {Promise<{suggestions: Array}>}
 */
export async function suggestMeals({ pantryItems, mealType, goal, calorieTarget, todaysWorkout }) {
  const res = await fetch(`${API_BASE}/ai/meals/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pantry_items: pantryItems.map((i) => ({
        name: i.name,
        category: i.category ?? null,
        quantity: i.quantity ?? null
      })),
      meal_type: mealType,
      goal: goal ?? 'manutencao',
      calorie_target: calorieTarget ?? null,
      todays_workout: todaysWorkout ?? null
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao buscar sugestões: ${err}`);
  }

  return res.json(); // { suggestions: [...] }
}
