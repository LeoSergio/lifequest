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

export async function showProBenefits() {
  const { showConfirm } = await import('./modal.js');
  const ok = await showConfirm({
    title: 'Desbloqueie seu Potencial 🌟',
    message: `
      <div style="text-align: left; padding: 12px; background: rgba(0,0,0,0.25); border-radius: 16px; margin-top: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <h3 style="color: #FFD700; font-size: 15px; margin-bottom: 16px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Vantagens do LifeQuest PRO</h3>
        
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
          <div style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🤖</div>
          <div><strong style="color: #fff; font-size: 14px;">Inteligência Artificial Ilimitada</strong><br><span style="font-size: 13px; color: rgba(255,255,255,0.6);">Geração de treinos, análises e sugestões de dieta sem bloqueios diários.</span></div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
          <div style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">📊</div>
          <div><strong style="color: #fff; font-size: 14px;">Métricas Avançadas</strong><br><span style="font-size: 13px; color: rgba(255,255,255,0.6);">Acompanhe seu progresso real de hipertrofia com gráficos precisos.</span></div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
          <div style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">💎</div>
          <div><strong style="color: #fff; font-size: 14px;">Economia Premium</strong><br><span style="font-size: 13px; color: rgba(255,255,255,0.6);">Receba Pro Coins mensais para gastar na loja com itens épicos.</span></div>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🎨</div>
          <div><strong style="color: #fff; font-size: 14px;">Personalização Total</strong><br><span style="font-size: 13px; color: rgba(255,255,255,0.6);">Avatares exclusivos, temas dinâmicos e customização completa do perfil.</span></div>
        </div>
      </div>
      <div style="margin-top: 16px; font-size: 14px; color: #ccc; line-height: 1.4;">
        Tudo isso por apenas <strong style="color: #fff; font-size: 15px;">R$ 4,99/mês</strong>.<br>Cancele quando quiser, sem burocracia.
      </div>
    `,
    icon: '🚀',
    confirmText: 'Assinar PRO (R$ 4,99)',
    cancelText: 'Voltar',
    type: 'default'
  });

  if (ok) {
    try {
      const token = localStorage.getItem('access_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/payments/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error("Backend Error:", errText);
        throw new Error('Falha ao iniciar pagamento: ' + errText);
      }
      
      const response = await res.json();
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      console.error(err);
      const { showAlert } = await import('./modal.js');
      showAlert({ title: 'Erro', message: 'Não foi possível iniciar o pagamento. Tente novamente mais tarde.', type: 'danger' });
    }
  }
}
