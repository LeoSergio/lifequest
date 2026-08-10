import App from './App.svelte';
import './styles/app.css';
import { db } from './db/db.js';
import { startSyncWorker } from './services/syncService.js';
import { inject } from '@vercel/analytics';

// Injeta o Vercel Analytics (apenas em produção/quando deployado na Vercel)
inject();

// Atualiza o app automaticamente assim que uma nova versão do Service Worker assumir o controle
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Aguarda o Dexie abrir e migrar o banco antes de registrar os hooks de sync.
// Sem isso, setupSyncHooks() pode tentar acessar tabelas que ainda estão
// sendo criadas/migradas, e os hooks nunca disparam.
db.open().then(() => {
  startSyncWorker(10);
}).catch(err => {
  console.error('[DB] Falha ao abrir banco local:', err);
});

const app = new App({
  target: document.getElementById('app')
});

export default app;
