/**
 * Service de metas — use cases da funcionalidade de Goals.
 *
 * Metas registram progresso e conquistas, mas NÃO concedem XP.
 * XP vem exclusivamente de missões diárias e conquistas automáticas do sistema.
 */
import { isGoalAchieved } from '../lib/goals.js';
import { addGoal, updateGoal, deleteGoal } from '../repositories/goalRepository.js';
import { checkAchievements } from '../lib/achievements.js';

export { addGoal, deleteGoal };

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

  // XP não é concedido por metas: apenas missões e conquistas geram XP.
  if (!wasAchieved && nowAchieved) {
    await checkAchievements();
  }

  return {
    achieved: !wasAchieved && nowAchieved,
    updatedGoal: { ...goal, ...updates }
  };
}
