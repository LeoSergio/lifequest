<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';
  import { nav } from './lib/nav.js';
  import Onboarding from './routes/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Pantry from './routes/Pantry.svelte';
  import HabitsAndGoals from './routes/HabitsAndGoals.svelte';
  import Goals from './routes/Goals.svelte';
  import Training from './routes/Training.svelte';
  import NewWorkoutPlan from './routes/NewWorkoutPlan.svelte';
  import TrainingMetrics from './routes/TrainingMetrics.svelte';
  import WorkoutPlanDetail from './routes/WorkoutPlanDetail.svelte';
  import Quests from './routes/Quests.svelte';
  import Profile from './routes/Profile.svelte';
  import Stats from './routes/Stats.svelte';
  import NavBar from './components/NavBar.svelte';
  import BackgroundBlobs from './components/BackgroundBlobs.svelte';
  import SyncBadge from './components/SyncBadge.svelte';
  import Modal from './components/Modal.svelte';
  import Ranking from './routes/Ranking.svelte';
  import { startQuestService, stopQuestService } from './services/questService.js';

  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);

  // Inicia o serviço global de missões diárias assim que o player estiver disponível.
  // Fica ativo independente de qual rota o usuário estiver navegando.
  let questServiceStarted = false;
  $: if ($hasPlayer && !questServiceStarted) {
    questServiceStarted = true;
    startQuestService();
  } else if ($hasPlayer === false && questServiceStarted) {
    // Logout: para o timer
    questServiceStarted = false;
    stopQuestService();
  }
</script>
<BackgroundBlobs />
<Modal />
{#if $hasPlayer}
  <SyncBadge />
{/if}

{#if $hasPlayer === undefined}
  <main class="min-h-screen flex items-center justify-center">
    <p class="text-white/40 text-sm">Carregando...</p>
  </main>
{:else if $hasPlayer}
  {#if $nav.name === 'pantry'}
    <Pantry />
  {:else if $nav.name === 'habits'}
    <HabitsAndGoals />
  {:else if $nav.name === 'goals'}
    <Goals />
  {:else if $nav.name === 'training'}
    <Training />
  {:else if $nav.name === 'training-new'}
    <NewWorkoutPlan />
  {:else if $nav.name === 'training-metrics'}
    <TrainingMetrics focusPlanId={$nav.params.focusPlanId} />
  {:else if $nav.name === 'workout-plan-detail'}
    <WorkoutPlanDetail planId={$nav.params.planId} isEditing={$nav.params.edit || false} isNew={$nav.params.isNew || false} />
  {:else if $nav.name === 'quests'}
    <Quests />
  {:else if $nav.name === 'ranking'}
    <Ranking />
  {:else if $nav.name === 'profile'}
    <Profile />
  {:else if $nav.name === 'stats'}
    <Stats />
  {:else}
    <Dashboard />
  {/if}
  <NavBar />
{:else}
  <Onboarding />
{/if}
