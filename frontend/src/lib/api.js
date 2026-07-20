/**
 * URL base da API do LifeQuest.
 *
 * Em desenvolvimento local: defina VITE_API_URL no .env.local
 *   Ex: VITE_API_URL=http://192.168.1.71:8000
 * Fallback: http://localhost:8000
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Backend é 100% stateless: cada chamada envia o contexto necessário
// (itens da despensa, objetivo, feedback de treino) no próprio payload.
export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  // ── IA ────────────────────────────────────────────────────────────────────
  generateArchetype: (answers) =>
    request('/ai/onboarding/archetype', { method: 'POST', body: JSON.stringify({ answers }) }),

  generateMission: (payload) =>
    request('/ai/missions/generate', { method: 'POST', body: JSON.stringify(payload) }),

  generateRecipe: (payload) =>
    request('/ai/recipes/generate', { method: 'POST', body: JSON.stringify(payload) }),

  generateWorkoutFeedback: (payload) =>
    request('/ai/workouts/calibrate', { method: 'POST', body: JSON.stringify(payload) }),

  suggestMeals: (payload) =>
    request('/ai/meals/suggest', { method: 'POST', body: JSON.stringify(payload) }),
};

