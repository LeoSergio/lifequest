<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';
  import { nav } from './lib/nav.js';
  import Onboarding from './routes/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Pantry from './routes/Pantry.svelte';
  import ScanReceipt from './routes/ScanReceipt.svelte';
  import Training from './routes/Training.svelte';
  import WorkoutPlanDetail from './routes/WorkoutPlanDetail.svelte';
  import NavBar from './components/NavBar.svelte';

  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);
</script>

{#if $hasPlayer === undefined}
  <main class="min-h-screen flex items-center justify-center">
    <p class="text-white/40 text-sm">Carregando...</p>
  </main>
{:else if $hasPlayer}
  {#if $nav.name === 'pantry'}
    <Pantry />
  {:else if $nav.name === 'scan'}
    <ScanReceipt />
  {:else if $nav.name === 'training'}
    <Training />
  {:else if $nav.name === 'workout-plan-detail'}
    <WorkoutPlanDetail planId={$nav.params.planId} />
  {:else}
    <Dashboard />
  {/if}
  <NavBar />
{:else}
  <Onboarding />
{/if}
