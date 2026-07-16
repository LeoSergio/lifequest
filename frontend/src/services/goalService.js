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

  let leveledUp = false;
  let level = null;

  // XP extra da meta só é concedido uma vez, no momento exato em que
  // ela vira "alcançada" — nunca de novo, mesmo que o registro seja
  // reaberto/editado depois.
  if (!wasAchieved && nowAchieved) {
    const player = await getPlayer();
    if (player) {
      const result = applyXp(player.level, player.xp, goal.xpReward);
      await updatePlayer(player.id, { level: result.level, xp: result.xp });
      leveledUp = result.leveledUp;
      level = result.level;
    }
  }

  return {
    achieved: !wasAchieved && nowAchieved,
    leveledUp,
    level,
    updatedGoal: { ...goal, ...updates }
  };
}
