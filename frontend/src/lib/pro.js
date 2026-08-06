import { showAlert } from './modal.js';

/**
 * Helper central para lógica de planos Free vs PRO.
 *
 * Regras de negócio:
 * - isPro(player): retorna true se o player tem assinatura ativa
 * - Limites para free: definidos em FREE_LIMITS
 * - Limites para verificar uso diário: via localStorage com chave + data
 */

// ─── Status PRO ────────────────────────────────────────────────────────────────

/**
 * Verifica se o player tem assinatura PRO ativa.
 * Suporta PRO vitalício (sem proExpiresAt) e PRO com validade.
 */
export function isPro(player) {
  if (!player?.isPro) return false;
  if (!player.proExpiresAt) return true; // PRO vitalício
  return new Date(player.proExpiresAt) > new Date();
}

// ─── Limites Free ──────────────────────────────────────────────────────────────

export const FREE_LIMITS = {
  aiMealsPerDay: 1,    // sugestões de refeição por IA por dia
  maxHabits: 5,        // hábitos simultâneos
  maxEpicQuests: 1,    // missões épicas ativas
};

// ─── Uso Diário (localStorage) ─────────────────────────────────────────────────

const todayKey = () => new Date().toISOString().slice(0, 10); // "2026-08-06"

/**
 * Retorna quantas vezes uma feature foi usada hoje.
 * @param {string} feature  Ex: 'ai_meals'
 */
export function getDailyUsage(feature) {
  const key = `lq_usage_${feature}_${todayKey()}`;
  return parseInt(localStorage.getItem(key) ?? '0', 10);
}

/**
 * Incrementa o contador de uso diário de uma feature.
 * @param {string} feature
 */
export function incrementDailyUsage(feature) {
  const key = `lq_usage_${feature}_${todayKey()}`;
  const current = getDailyUsage(feature);
  localStorage.setItem(key, String(current + 1));
}

/**
 * Verifica se o usuário free ainda pode usar uma feature hoje.
 * @param {string} feature  Ex: 'ai_meals'
 * @param {object} player
 * @returns {{ allowed: boolean, used: number, limit: number }}
 */
export function checkDailyLimit(feature, player) {
  if (isPro(player)) return { allowed: true, used: 0, limit: Infinity };
  const limit = FREE_LIMITS[`${feature}PerDay`] ?? FREE_LIMITS[feature] ?? 1;
  const used = getDailyUsage(feature);
  return { allowed: used < limit, used, limit };
}

export function showProBenefits() {
  showAlert({
    title: 'LifeQuest PRO 🌟',
    message: 'Benefícios exclusivos para membros PRO:\n\n🤖 Treinos gerados por Inteligência Artificial\n📊 Métricas e gráficos avançados\n💎 Pro Coins mensais para gastar na loja\n🎨 Avatares e Temas exclusivos\n\nTorne-se PRO e acelere sua evolução!',
    icon: '⭐',
    confirmText: 'Assinar agora',
    type: 'info'
  });
}
