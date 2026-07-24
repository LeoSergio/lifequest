import { db } from '../db/db.js';

export const ACHIEVEMENTS = [
  { id: 'madrugador', name: 'Madrugador', description: 'Completou um treino antes das 6h da manhã.', icon: '🌅', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  { id: 'invencivel_10', name: 'Aprendiz Focado', description: 'Chegou a 10 dias de ofensiva.', icon: '🔥', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  { id: 'invencivel_100', name: 'Invencível', description: 'Chegou a 100 dias de ofensiva.', icon: '👑', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { id: 'maquina_de_ferro', name: 'Máquina de Ferro', description: 'Fez 5 treinos em uma semana.', icon: '🦾', color: 'text-gray-400', bg: 'bg-gray-400/10 border-gray-400/20' },
  { id: 'primeiro_habito', name: 'O Começo', description: 'Completou seu primeiro hábito.', icon: '🌱', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  { id: 'mestre_das_metas', name: 'Realizador', description: 'Alcançou 3 metas.', icon: '🎯', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  { id: 'chef_iniciante', name: 'Chef Iniciante', description: 'Adicionou sua primeira receita.', icon: '🍳', color: 'text-yellow-600', bg: 'bg-yellow-600/10 border-yellow-600/20' },
  { id: 'monstro_do_pantano', name: 'Hidratado', description: 'Concluiu a meta de beber água.', icon: '💧', color: 'text-blue-300', bg: 'bg-blue-300/10 border-blue-300/20' }
];

export async function checkAchievements() {
  const unlocked = await db.unlockedAchievements.toArray();
  const unlockedIds = new Set(unlocked.map(a => a.achievementId));
  const newUnlocks = [];

  const player = await db.player.toCollection().first();
  if (!player) return;

  // check invencivel
  if (player.streak >= 10 && !unlockedIds.has('invencivel_10')) newUnlocks.push('invencivel_10');
  if (player.streak >= 100 && !unlockedIds.has('invencivel_100')) newUnlocks.push('invencivel_100');

  // check primeiro habito
  if (!unlockedIds.has('primeiro_habito')) {
    const completions = await db.habitCompletions.count();
    if (completions >= 1) newUnlocks.push('primeiro_habito');
  }

  // check metas
  if (!unlockedIds.has('mestre_das_metas')) {
    const goalsAchieved = await db.goals.filter(g => g.achievedAt != null).count();
    if (goalsAchieved >= 3) newUnlocks.push('mestre_das_metas');
  }

  // check chef
  if (!unlockedIds.has('chef_iniciante')) {
    const recipes = await db.recipes.count();
    if (recipes >= 1) newUnlocks.push('chef_iniciante');
  }

  // check madrugador
  if (!unlockedIds.has('madrugador')) {
    const sessions = await db.workoutSessions.toArray();
    const hasEarly = sessions.some(s => {
      if (!s.finishedAt) return false;
      const date = new Date(s.finishedAt);
      return date.getHours() < 6;
    });
    if (hasEarly) newUnlocks.push('madrugador');
  }

  // check maquina de ferro (5 workouts in last 7 days)
  if (!unlockedIds.has('maquina_de_ferro')) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentWorkouts = await db.workoutSessions.filter(s => {
          if (!s.finishedAt) return false;
          return new Date(s.finishedAt) > sevenDaysAgo;
      }).count();
      
      if (recentWorkouts >= 5) newUnlocks.push('maquina_de_ferro');
  }

  // check monstro do pantano (just an example, if title includes 'água' and achieved)
  if (!unlockedIds.has('monstro_do_pantano')) {
      const waterGoals = await db.goals.filter(g => g.title.toLowerCase().includes('água') && g.achievedAt != null).count();
      const waterHabits = await db.habits.filter(h => h.title.toLowerCase().includes('água')).toArray();
      
      let waterCompletions = 0;
      for (const h of waterHabits) {
          waterCompletions += await db.habitCompletions.where('habitId').equals(h.id).count();
      }

      if (waterGoals >= 1 || waterCompletions >= 1) {
          newUnlocks.push('monstro_do_pantano');
      }
  }

  // Save new unlocks
  for (const id of newUnlocks) {
    await db.unlockedAchievements.add({
      achievementId: id,
      unlockedAt: new Date().toISOString()
    });
    
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) {
        // We use setTimeout to allow DB transaction to finish and state to update before alerting
        setTimeout(() => {
            alert(`🏅 CONQUISTA DESBLOQUEADA!\n\n${ach.name}\n${ach.description}`);
        }, 500);
    }
  }
}
