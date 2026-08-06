/**
 * Service de hábitos — use cases da funcionalidade de hábitos.
 *
 * Hábitos registram completões e verificam conquistas, mas NÃO concedem XP.
 * XP vem exclusivamente de missões diárias e conquistas automáticas do sistema.
 */
import { completedToday, todayIso, weeklyCount } from '../lib/habits.js';
import { addCompletion, addHabit, archiveHabit, deleteHabit } from '../repositories/habitRepository.js';
import { checkAchievements } from '../lib/achievements.js';

export { addHabit, archiveHabit, deleteHabit };

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

  // XP não é concedido por hábitos: apenas missões e conquistas geram XP.
  await checkAchievements();
  return { leveledUp: false, level: 0 };
}
