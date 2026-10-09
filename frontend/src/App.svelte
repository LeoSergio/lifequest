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
  import { navigate } from './lib/nav.js';
  import { cancelWorkoutSession } from './services/workoutService.js';
  import { showConfirm } from './lib/modal.js';

  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);
  const activeSessionLive = liveQuery(async () => {
    return await db.workoutSessions.filter(s => !s.finishedAt && !s.isRestDay).first();
  });

  let activePlanName = '';
  $: if ($activeSessionLive) {
    if ($activeSessionLive.workoutPlanId) {
      db.workoutPlans.get($activeSessionLive.workoutPlanId).then(p => {
        if (!p) {
          // Plano inexistente/deletado -> sessão órfã! Limpa automaticamente.
          cancelWorkoutSession($activeSessionLive.id);
          activePlanName = '';
        } else {
          activePlanName = p.name || '';
        }
      }).catch(() => {});
    } else {
      cancelWorkoutSession($activeSessionLive.id);
      activePlanName = '';
    }
  } else {
    activePlanName = '';
  }

  async function handleDismissSession(e) {
    e.stopPropagation();
    if (!$activeSessionLive) return;
    const ok = await showConfirm({
      title: 'Descartar treino?',
      message: 'Tem certeza que deseja cancelar e descartar este treino em andamento?',
      icon: '🗑️',
      type: 'danger',
      confirmText: 'Descartar',
      cancelText: 'Continuar'
    });
    if (ok) {
      await cancelWorkoutSession($activeSessionLive.id);
    }
  }

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

  {#if $activeSessionLive && $nav.name !== 'workout-plan-detail'}
    <aside 
      class="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-gradient-to-r from-[#9333EA] to-[#7928CA] text-white p-3 rounded-[16px] shadow-[0_8px_25px_rgba(147,51,234,0.5)] border border-white/20 flex items-center justify-between backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-transform"
      on:click={() => navigate('workout-plan-detail', { planId: $activeSessionLive.workoutPlanId })}
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        <div class="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping shrink-0"></div>
        <div class="min-w-0">
          <p class="text-[11px] font-black uppercase tracking-wider leading-none truncate">
            {activePlanName ? `Treino: ${activePlanName}` : 'Treino em andamento'}
          </p>
          <p class="text-[9px] text-white/80 mt-0.5">Toque para continuar preenchendo</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="text-[10px] text-white/70 hover:text-red-300 font-bold px-2 py-1 rounded-[6px] hover:bg-white/10 transition-colors"
          on:click={handleDismissSession}
          title="Descartar este treino"
        >
          Descartar
        </button>
        <span class="text-xs font-black bg-white/20 px-2.5 py-1 rounded-[8px]">Retornar →</span>
      </div>
    </aside>
  {/if}

  <NavBar />
{:else}
  <Onboarding />
{/if}
