import App from './App.svelte';
import './styles/app.css';
import { db } from './db/db.js';
import { startSyncWorker } from './services/syncService.js';

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
