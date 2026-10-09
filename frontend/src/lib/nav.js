import { writable } from 'svelte/store';

const NAV_STORAGE_KEY = 'lifequest_nav_state';

function getInitialNav() {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(NAV_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          // Se for workout-plan-detail sem um planId válido, volta para o dashboard
          if (parsed.name === 'workout-plan-detail' && (!parsed.params?.planId || parsed.params.planId === 'undefined')) {
            return { name: 'dashboard', params: {} };
          }
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
