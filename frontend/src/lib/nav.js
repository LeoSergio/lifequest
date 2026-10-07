import { writable } from 'svelte/store';

const NAV_STORAGE_KEY = 'lifequest_nav_state';

function getInitialNav() {
  if (typeof localStorage !== 'undefined') {
    try {
      // Se há um treino explicitamente ativo registrado, prioriza a tela do treino
      const activeWorkoutPlanId = localStorage.getItem('lifequest_active_workout_plan_id');
      const activeSessionId = localStorage.getItem('lifequest_active_workout_session_id');
      if (activeWorkoutPlanId && activeSessionId) {
        return { name: 'workout-plan-detail', params: { planId: activeWorkoutPlanId } };
      }

      const saved = localStorage.getItem(NAV_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          return { name: parsed.name, params: parsed.params || {} };
        }
      }
    } catch (_) {}
  }
  return { name: 'dashboard', params: {} };
}

export const nav = writable(getInitialNav());

export function navigate(name, params = {}) {
  const next = { name, params: params || {} };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
  }
  nav.set(next);
}
