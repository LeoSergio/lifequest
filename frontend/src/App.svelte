<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';
  import { currentRoute } from './lib/nav.js';
  import Onboarding from './routes/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Pantry from './routes/Pantry.svelte';
  import NavBar from './components/NavBar.svelte';

  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);
</script>

{#if $hasPlayer === undefined}
  <main class="min-h-screen flex items-center justify-center">
    <p class="text-white/40 text-sm">Carregando...</p>
  </main>
{:else if $hasPlayer}
  {#if $currentRoute === 'pantry'}
    <Pantry />
  {:else}
    <Dashboard />
  {/if}
  <NavBar />
{:else}
  <Onboarding />
{/if}

