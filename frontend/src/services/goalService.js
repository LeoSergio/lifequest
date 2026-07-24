/**
 * Service de metas — use cases da funcionalidade de Goals.
 *
 * Centraliza as regras de negócio: quando uma meta é alcançada,
 * como aplicar XP e garantir que o XP extra é concedido apenas uma vez.
 */
import { applyXp } from '../lib/gamification.js';
import { isGoalAchieved } from '../lib/goals.js';
import { addGoal, updateGoal } from '../repositories/goalRepository.js';
import { getPlayer, updatePlayer } from '../repositories/playerRepository.js';
import { checkAchievements } from '../lib/achievements.js';

export { addGoal };

/**
 * Adiciona progresso a uma meta.
 *
 * Retorna `{ achieved: boolean, leveledUp: boolean, level: number, updatedGoal }`.
 * A UI usa isso para decidir se exibe a tela de celebração e/ou level up.
 */
export async function addProgress(goal, amount) {
  if (!amount) return null;

  const newValue = Math.min(goal.targetValue, goal.currentValue + amount);
  const wasAchieved = isGoalAchieved(goal);
  const nowAchieved = newValue >= goal.targetValue;

  const updates = { currentValue: newValue };
  if (!wasAchieved && nowAchieved) {
    updates.achievedAt = new Date().toISOString();
  }

  await updateGoal(goal.id, updates);

  if (!wasAchieved && nowAchieved) {
    await checkAchievements();
  }

  return {
    achieved: !wasAchieved && nowAchieved,
    updatedGoal: { ...goal, ...updates }
  };
}
