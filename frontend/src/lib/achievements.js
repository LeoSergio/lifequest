import { db } from '../db/db.js';
import { generateId } from './id.js';
import { enqueue } from '../services/syncService.js';

export const ACHIEVEMENTS = [
  // Básicos
  { id: 'madrugador', name: 'Madrugador', description: 'Completou um treino antes das 6h da manhã.', icon: '🌅', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', xp: 100, coins: 10 },
  { id: 'invencivel_10', name: 'Aprendiz Focado', description: 'Chegou a 10 dias de ofensiva.', icon: '🔥', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', xp: 200, coins: 20 },
  { id: 'invencivel_100', name: 'Invencível', description: 'Chegou a 100 dias de ofensiva.', icon: '👑', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', xp: 1000, coins: 200 },
  { id: 'maquina_de_ferro', name: 'Máquina de Ferro', description: 'Fez 5 treinos em uma semana.', icon: '🦾', color: 'text-gray-400', bg: 'bg-gray-400/10 border-gray-400/20', xp: 150, coins: 15 },
  { id: 'primeiro_habito', name: 'O Começo', description: 'Completou seu primeiro hábito.', icon: '🌱', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', xp: 50, coins: 5 },
  { id: 'mestre_das_metas', name: 'Realizador', description: 'Alcançou 3 metas.', icon: '🎯', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', xp: 150, coins: 15 },
  { id: 'chef_iniciante', name: 'Chef Iniciante', description: 'Adicionou sua primeira receita.', icon: '🍳', color: 'text-yellow-600', bg: 'bg-yellow-600/10 border-yellow-600/20', xp: 50, coins: 5 },
  { id: 'monstro_do_pantano', name: 'Hidratado', description: 'Concluiu a meta de beber água.', icon: '💧', color: 'text-blue-300', bg: 'bg-blue-300/10 border-blue-300/20', xp: 50, coins: 5 },
  
  // Nível Médio (Intermediários)
  { id: 'sobrecarga_progressiva', name: 'Sobrecarga Progressiva', description: 'Aumentar o peso (kg) em um exercício base por 2 semanas consecutivas.', icon: '📈', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', xp: 300, coins: 50 },
  { id: 'rotina_matinal_15', name: 'Mestre da Rotina Matinal', description: 'Completar 15 treinos matinais.', icon: '☕', color: 'text-yellow-300', bg: 'bg-yellow-300/10 border-yellow-300/20', xp: 400, coins: 80 },
  { id: 'corpo_inteiro_ativado', name: 'Corpo Inteiro Ativado', description: 'Acender todas as regiões musculares em uma única semana.', icon: '🧍', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', xp: 350, coins: 60 },
  { id: 'disciplina_de_ferro', name: 'Disciplina de Ferro', description: 'Manter um Hábito com 100% de taxa de conclusão por 14 dias seguidos.', icon: '⛓️', color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', xp: 400, coins: 75 },
  { id: 'tonelagem_10k', name: 'Tonelagem de Respeito', description: 'Alcançar 10.000 kg de volume total em uma semana.', icon: '🏋️', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', xp: 500, coins: 100 },
  { id: 'meio_caminho', name: 'Meio Caminho Andado', description: 'Atingir 50% do progresso de uma Meta de longo prazo.', icon: '🌓', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', xp: 600, coins: 120 },
  { id: 'evolucao_visivel', name: 'Evolução Visível', description: 'Registrar segunda bateria de fotos e medidas após 30 dias.', icon: '📸', color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20', xp: 500, coins: 100 },
  { id: 'chef_ia_20', name: 'Cliente VIP do Chef IA', description: 'Preparar 20 receitas sugeridas pela inteligência artificial.', icon: '👨‍🍳', color: 'text-orange-300', bg: 'bg-orange-300/10 border-orange-300/20', xp: 450, coins: 90 },
  { id: 'mes_perfeito', name: 'Mês Perfeito', description: 'Bater a meta de frequência de treino em todas as semanas de um mês.', icon: '📅', color: 'text-indigo-400', bg: 'bg-indigo-400/10 border-indigo-400/20', xp: 800, coins: 150 },
  { id: 'tatico', name: 'Tático', description: 'Concluir 50 séries utilizando técnicas avançadas.', icon: '🧠', color: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/20', xp: 500, coins: 100 },

  // Nível Alto (Épicas)
  { id: 'titan_consistencia', name: 'Titan da Consistência', description: 'Treinar toda semana durante 6 meses ininterruptos.', icon: '🏛️', color: 'text-yellow-600', bg: 'bg-yellow-600/10 border-yellow-600/20', xp: 2000, coins: 400 },
  { id: 'dobro_forca', name: 'O Dobro de Força', description: 'Aumentar a carga máxima em 100% em um exercício composto.', icon: '💪', color: 'text-red-600', bg: 'bg-red-600/10 border-red-600/20', xp: 2500, coins: 500 },
  { id: 'clube_5am_100', name: 'Clube das 5 da Manhã', description: 'Concluir 100 treinos no período da manhã.', icon: '🦉', color: 'text-blue-600', bg: 'bg-blue-600/10 border-blue-600/20', xp: 3000, coins: 600 },
  { id: 'cem_dias_impecaveis', name: 'Cem Dias Impecáveis', description: 'Manter hábitos diários checados por 100 dias consecutivos.', icon: '💯', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', xp: 3500, coins: 700 },
  { id: 'montanha_ferro_50k', name: 'Montanha de Ferro', description: 'Ultrapassar 50.000 kg de tonelagem total em um único mês.', icon: '⛰️', color: 'text-gray-600', bg: 'bg-gray-600/10 border-gray-600/20', xp: 4000, coins: 800 },
  { id: 'simbiose_nutricional', name: 'Simbiose Nutricional', description: 'Gerar e consumir 100 refeições via Chef IA.', icon: '🥗', color: 'text-green-600', bg: 'bg-green-600/10 border-green-600/20', xp: 3000, coins: 600 },
  { id: 'fisico_esculpido', name: 'Físico Esculpido', description: 'Atingir 100% de uma meta complexa após meses.', icon: '🗿', color: 'text-purple-600', bg: 'bg-purple-600/10 border-purple-600/20', xp: 5000, coins: 1000 },
  { id: 'enciclopedia_humana', name: 'Enciclopédia Humana', description: 'Registrar progressão em 50 exercícios diferentes.', icon: '📖', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', xp: 2500, coins: 500 },
  { id: 'ano_transformacao', name: 'Ano da Transformação', description: 'Atualizar fotos e medidas sem pular nenhum mês em 1 ano.', icon: '🦋', color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/20', xp: 4500, coins: 900 },
  { id: 'lenda_aplicativo', name: 'Lenda do Aplicativo', description: 'Completar 1 ano exato usando Treino + Dispensa.', icon: '🏆', color: 'text-yellow-300', bg: 'bg-yellow-300/10 border-yellow-300/20', xp: 10000, coins: 2000 }
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

  // check meio_caminho
  if (!unlockedIds.has('meio_caminho')) {
      const halfGoals = await db.goals.filter(g => g.currentValue >= (g.targetValue / 2) && g.targetValue > 0).count();
      if (halfGoals >= 1) newUnlocks.push('meio_caminho');
  }

  // check recipes (chef_ia_20, simbiose_nutricional)
  if (!unlockedIds.has('chef_ia_20') || !unlockedIds.has('simbiose_nutricional')) {
      const recipesCount = await db.recipes.count();
      if (recipesCount >= 20 && !unlockedIds.has('chef_ia_20')) newUnlocks.push('chef_ia_20');
      if (recipesCount >= 100 && !unlockedIds.has('simbiose_nutricional')) newUnlocks.push('simbiose_nutricional');
  }

  // check morning workouts (rotina_matinal_15, clube_5am_100)
  if (!unlockedIds.has('rotina_matinal_15') || !unlockedIds.has('clube_5am_100')) {
      const sessions = await db.workoutSessions.toArray();
      const morningSessions = sessions.filter(s => {
          if (!s.finishedAt) return false;
          return new Date(s.finishedAt).getHours() < 6;
      }).length;
      if (morningSessions >= 15 && !unlockedIds.has('rotina_matinal_15')) newUnlocks.push('rotina_matinal_15');
      if (morningSessions >= 100 && !unlockedIds.has('clube_5am_100')) newUnlocks.push('clube_5am_100');
  }

  // check enciclopedia_humana (50 unique exercises)
  if (!unlockedIds.has('enciclopedia_humana')) {
      const sets = await db.sessionSets.toArray();
      const uniqueExercises = new Set(sets.map(s => s.exerciseId).filter(id => id != null));
      if (uniqueExercises.size >= 50) newUnlocks.push('enciclopedia_humana');
  }

  // check tonelagem_10k (rough estimate per session in last 7 days)
  if (!unlockedIds.has('tonelagem_10k')) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentSessions = await db.workoutSessions.filter(s => s.finishedAt && new Date(s.finishedAt) > sevenDaysAgo).toArray();
      const sessionIds = recentSessions.map(s => s.id);
      
      const recentSets = await db.sessionSets.where('workoutSessionId').anyOf(sessionIds).toArray();
      let totalTonnage = 0;
      for (const set of recentSets) {
          totalTonnage += (set.weightKg || 0) * (set.repsDone || 0);
      }
      if (totalTonnage >= 10000) newUnlocks.push('tonelagem_10k');
      if (totalTonnage >= 50000 && !unlockedIds.has('montanha_ferro_50k')) newUnlocks.push('montanha_ferro_50k');
  }

  // Save new unlocks and reward player
  for (const id of newUnlocks) {
    const item = {
      id: generateId(),
      achievementId: id,
      unlockedAt: new Date().toISOString()
    };
    await db.unlockedAchievements.add(item);
    await enqueue('upsert', 'unlockedAchievements', item.id, item);
    
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) {
        // Grant Rewards
        if (ach.xp || ach.coins) {
            const xpToAdd = ach.xp || 0;
            const coinsToAdd = ach.coins || 0;
            await db.player.update(player.id, { 
                xp: player.xp + xpToAdd, 
                coins: (player.coins || 0) + coinsToAdd 
            });
            await enqueue('upsert', 'player', player.id, { 
                xp: player.xp + xpToAdd, 
                coins: (player.coins || 0) + coinsToAdd 
            });
        }

        // Alert user
        setTimeout(() => {
            let rewardText = [];
            if (ach.xp) rewardText.push(`+${ach.xp} XP`);
            if (ach.coins) rewardText.push(`+${ach.coins} Moedas`);
            const rewardString = rewardText.length > 0 ? `\nRecompensas: ${rewardText.join(' | ')}` : '';
            
            alert(`🏅 CONQUISTA DESBLOQUEADA!\n\n${ach.name}\n${ach.description}${rewardString}`);
        }, 500);
    }
  }
}
