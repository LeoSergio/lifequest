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
db.open().then(async () => {
  startSyncWorker(10);

  // Detecta retorno do checkout do Mercado Pago (?payment=success)
  // Força um pullSync imediato para trazer o isPro=true salvo pelo webhook.
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    // Remove o parâmetro da URL sem recarregar a página
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Aguarda um pouco para o webhook do MP ter tempo de processar
    await new Promise(r => setTimeout(r, 2000));

    const { pullSync } = await import('./services/syncService.js');
    await pullSync();
    console.log('[Payment] pullSync forçado após retorno do checkout.');
  }
}).catch(err => {
  console.error('[DB] Falha ao abrir banco local:', err);
});

const app = new App({
  target: document.getElementById('app')
});

export default app;
