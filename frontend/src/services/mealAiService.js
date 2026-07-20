/**
 * Serviço de sugestões de refeição via IA.
 * Usa o cliente centralizado em lib/api.js.
 *
 * @param {object} params
 * @param {Array}  params.pantryItems    - Itens da despensa [{name, category, quantity}]
 * @param {string} params.mealType       - cafe_manha | almoco | janta | lanche
 * @param {string} params.goal           - hipertrofia | emagrecimento | manutencao | ganho_peso
 * @param {number|null} params.calorieTarget - Meta calórica para essa refeição
 * @param {string|null} params.todaysWorkout - Ex: "Peito e Tríceps"
 * @param {string|null} params.userRequest   - Pedido livre do usuário
 * @returns {Promise<{suggestions: Array}>}
 */
import { api } from '../lib/api.js';

export async function suggestMeals({ pantryItems, mealType, goal, calorieTarget, todaysWorkout, userRequest }) {
  return api.suggestMeals({
    pantry_items: pantryItems.map((i) => ({
      name: i.name,
      category: i.category ?? null,
      quantity: i.quantity ?? null
    })),
    meal_type: mealType,
    goal: goal ?? 'manutencao',
    calorie_target: calorieTarget ?? null,
    todays_workout: todaysWorkout ?? null,
    user_request: userRequest ?? null
  });
}
