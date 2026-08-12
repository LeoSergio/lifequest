/**
 * questService.js — Serviço global de missões diárias.
 *
 * Responsabilidades:
 *  1. Verificar se já existem missões para o dia atual ao iniciar.
 *  2. Gerar automaticamente novas missões via IA se não houver.
 *  3. Agendar a verificação para a próxima meia-noite local e se re-agendar
 *     indefinidamente — sem depender de nenhuma rota específica estar aberta.
 *
 * Deve ser iniciado uma única vez, no App.svelte, após o player estar disponível.
 */
import { db } from '../db/db.js';
import { todayIso } from '../lib/habits.js';
import { generateId } from '../lib/id.js';
import { API_BASE } from '../lib/api.js';

let midnightTimer = null;

/**
 * Busca e salva missões diárias da IA para o dia atual.
 * Apaga qualquer missão de hoje já existente antes de salvar
 * (evita duplicatas em caso de retry).
 */
async function generateTodayQuests() {
  const token = localStorage.getItem('access_token');
  if (!token) return;

  const player = await db.player.toCollection().first();
  if (!player) return;

  // Títulos recentes (últimos 7 dias) para evitar repetição
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
  const recent = await db.dailyQuests.where('date').above(cutoff).toArray();
  const recentTitles = recent.map(q => q.title);

  try {
    const response = await fetch(`${API_BASE}/ai/quests/daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        player_level: player.level,
        focus_areas: ['saúde', 'desenvolvimento pessoal', 'organização'],
        recent_quest_titles: recentTitles,
      }),
    });

    if (!response.ok) {
      console.warn('[QuestService] IA indisponível, status:', response.status);
      return;
    }

    const data = await response.json();
    const today = todayIso();

    // Remove as missões de hoje antes de inserir novas (idempotente)
    await db.dailyQuests.where('date').equals(today).delete();

    for (const q of data.quests) {
      await db.dailyQuests.add({
        id: generateId(),
        date: today,
        pillar: q.pillar,
        title: q.title,
        description: q.description,
        xpReward: q.xp_reward,
        completed: false,
      });
    }

    console.log('[QuestService] Missões do dia geradas com sucesso.');
  } catch (err) {
    console.warn('[QuestService] Falha ao gerar missões:', err);
  }
}

/**
 * Verifica se já há missões para hoje. Se não houver, gera automaticamente.
 */
async function checkAndGenerate() {
  const today = todayIso();
  const existing = await db.dailyQuests.where('date').equals(today).count();
  if (existing === 0) {
    await generateTodayQuests();
  }
}

/**
 * Agenda a verificação para a próxima meia-noite local (00:00:05),
 * e re-agenda automaticamente a cada virada de dia.
 */
function scheduleMidnightCheck() {
  if (midnightTimer) clearTimeout(midnightTimer);

  const now = new Date();
  // 00:00:05 do próximo dia no horário local
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  midnightTimer = setTimeout(async () => {
    await checkAndGenerate();
    scheduleMidnightCheck(); // re-agenda para a meia-noite seguinte
  }, msUntilMidnight);

  console.log(
    `[QuestService] Próxima renovação em ${Math.round(msUntilMidnight / 1000 / 60)} minutos.`
  );
}

/**
 * Inicializa o serviço de missões diárias.
 * Deve ser chamado uma única vez após o login/player estar disponível.
 */
export async function startQuestService() {
  await checkAndGenerate();  // verifica imediatamente
  scheduleMidnightCheck();   // agenda renovação automática à meia-noite
}

/**
 * Para o serviço (útil para logout ou testes).
 */
export function stopQuestService() {
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
}
