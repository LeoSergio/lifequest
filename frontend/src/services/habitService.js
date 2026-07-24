/**
 * Service de hábitos — use cases da funcionalidade de hábitos.
 *
 * Orquestra as regras de negócio (quando pode marcar, aplicar XP,
 * verificar level up) sem saber nada sobre a UI.
 */
import { applyXp } from '../lib/gamification.js';
import { completedToday, todayIso, weeklyCount } from '../lib/habits.js';
import { addCompletion, addHabit, archiveHabit } from '../repositories/habitRepository.js';
import { getPlayer, updatePlayer } from '../repositories/playerRepository.js';
import { checkAchievements } from '../lib/achievements.js';

export { addHabit, archiveHabit };

/**
 * Marca um hábito como concluído hoje e aplica o XP ao jogador.
 *
 * Retorna `{ leveledUp: boolean, level: number }` para que a UI
 * possa exibir a celebração de level up se necessário.
 */
export async function completeHabit(habit, completions) {
  // Guarda de negócio: não permite marcar duas vezes no mesmo período
  if (habit.cadence === 'daily' && completedToday(habit.id, completions)) return null;
  if (habit.cadence === 'weekly' && weeklyCount(habit.id, completions) >= habit.weeklyTarget) return null;

  await addCompletion(habit.id, todayIso());

  await checkAchievements();
  return { leveledUp: false, level: 0 };
}
