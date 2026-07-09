const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
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
  generateMission: (payload) =>
    request('/ai/missions/generate', { method: 'POST', body: JSON.stringify(payload) }),

  generateRecipe: (payload) =>
    request('/ai/recipes/generate', { method: 'POST', body: JSON.stringify(payload) }),

  generateWorkoutFeedback: (payload) =>
    request('/ai/workouts/calibrate', { method: 'POST', body: JSON.stringify(payload) }),

  ocrReceipt: (payload) =>
    request('/ai/receipts/parse', { method: 'POST', body: JSON.stringify(payload) })
};
