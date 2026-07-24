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
  import Shop from './routes/Shop.svelte';
  import Profile from './routes/Profile.svelte';
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
    <WorkoutPlanDetail planId={$nav.params.planId} />
  {:else if $nav.name === 'quests'}
    <Quests />
  {:else if $nav.name === 'shop'}
    <Shop />
  {:else if $nav.name === 'profile'}
    <Profile />
  {:else}
    <Dashboard />
  {/if}
  <NavBar />
{:else}
  <Onboarding />
{/if}
