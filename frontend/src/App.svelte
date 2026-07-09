<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';
  import Onboarding from './routes/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';

  // Regra de navegação da Etapa 4: sem player salvo -> Onboarding.
  // Com player salvo -> Dashboard. Reativo: assim que o Onboarding
  // salvar o player no Dexie, essa liveQuery dispara de novo sozinha
  // e a tela troca, sem precisarmos de router nem de eventos manuais.
  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);
</script>

{#await $hasPlayer then playerExists}
  {#if playerExists}
    <Dashboard />
  {:else}
    <Onboarding />
  {/if}
{/await}
