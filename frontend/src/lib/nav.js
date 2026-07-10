import { writable } from 'svelte/store';

// Evolução da store de navegação: agora guarda um objeto { name, params }
// em vez de só uma string. Isso permite abrir telas de DETALHE, como
// "o treino específico com id=3", sem precisar de uma lib de rotas.
export const nav = writable({ name: 'dashboard', params: {} });

export function navigate(name, params = {}) {
  nav.set({ name, params });
}
