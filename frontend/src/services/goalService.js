/**
 * Service de metas — use cases da funcionalidade de Goals.
 */
import { isGoalAchieved } from '../lib/goals.js';
import { addGoal, updateGoal, deleteGoal } from '../repositories/goalRepository.js';
import { checkAchievements } from '../lib/achievements.js';
import { applyXp } from '../lib/gamification.js';
import { getPlayer, updatePlayer } from '../repositories/playerRepository.js';

export { addGoal, deleteGoal };

/**
 * Adiciona progresso a uma meta.
 *
 * Ao atingir a meta pela primeira vez, concede +50 XP ao jogador.
 * Retorna `{ achieved, leveledUp, level, xpGained, updatedGoal }`.
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
  let level = 1;
  const xpGained = 50; // XP fixo por meta concluída

  if (!wasAchieved && nowAchieved) {
    // Concede XP ao completar a meta
    const p = await getPlayer();
    if (p) {
      const result = applyXp(p.level, p.xp, xpGained);
      leveledUp = result.leveledUp;
      level = result.level;
      await updatePlayer(p.id, { level: result.level, xp: result.xp });
    }
    await checkAchievements();
  }

  return {
    achieved: !wasAchieved && nowAchieved,
    leveledUp,
    level,
    xpGained: (!wasAchieved && nowAchieved) ? xpGained : 0,
    updatedGoal: { ...goal, ...updates }
  };
}

