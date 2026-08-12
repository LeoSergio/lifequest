/**
 * Service de hábitos — use cases da funcionalidade de hábitos.
 */
import { completedToday, todayIso, weeklyCount } from '../lib/habits.js';
import { addCompletion, addHabit, archiveHabit, deleteHabit } from '../repositories/habitRepository.js';
import { checkAchievements } from '../lib/achievements.js';
import { applyXp } from '../lib/gamification.js';
import { getPlayer, updatePlayer } from '../repositories/playerRepository.js';
import { db } from '../db/db.js';

export { addHabit, archiveHabit, deleteHabit };

/**
 * Marca um hábito como concluído hoje e aplica o XP ao jogador.
 *
 * XP concedido:
 *   - Hábito diário: +10 XP por conclusão
 *   - Hábito semanal: +15 XP por check, +20 XP bônus ao completar a meta semanal
 *
 * Retorna `{ leveledUp, level, xpGained }` para que a UI possa exibir celebração.
 */
export async function completeHabit(habit, _completions) {
  // Busca as completions direto do banco para evitar stale state
  const liveCompletions = await db.habitCompletions.toArray();

  // Guarda de negócio: não permite marcar duas vezes no mesmo período
  if (habit.cadence === 'daily' && completedToday(habit.id, liveCompletions)) return null;
  if (habit.cadence === 'weekly' && weeklyCount(habit.id, liveCompletions) >= (habit.weeklyTarget || 999)) return null;

  await addCompletion(habit.id, todayIso());

  // Recalcula após adicionar para verificar se completou a meta semanal
  const updatedCompletions = await db.habitCompletions.toArray();
  const newWeekCount = habit.cadence === 'weekly' ? weeklyCount(habit.id, updatedCompletions) : 0;
  const weeklyGoalMet = habit.cadence === 'weekly' && newWeekCount >= (habit.weeklyTarget || 1);

  // XP fixo: 10 para diário, 15 por check semanal + 20 de bônus se completou a meta
  const xpGained = habit.cadence === 'daily'
    ? 10
    : (15 + (weeklyGoalMet ? 20 : 0));

  const p = await getPlayer();
  let leveledUp = false;
  let level = p?.level ?? 1;

  if (p) {
    const result = applyXp(p.level, p.xp, xpGained);
    leveledUp = result.leveledUp;
    level = result.level;
    await updatePlayer(p.id, { level: result.level, xp: result.xp });
  }

  await checkAchievements();
  return { leveledUp, level, xpGained, weeklyGoalMet };
}

