import App from './App.svelte';
import './styles/app.css';
import { startSyncWorker } from './services/syncService.js';

// Inicia o carteiro invisível que cuida do Push/Pull a cada 10 segundos
startSyncWorker(10);

const app = new App({
  target: document.getElementById('app')
});

export default app;
