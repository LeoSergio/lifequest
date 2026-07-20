<script>
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';
  import { workoutPlansQuery } from '../repositories/workoutRepository.js';
  import { removePlan } from '../services/workoutService.js';

  const plans = workoutPlansQuery();

  let openMenuId = null;

  function weekdayLabel(plan) {
    if (plan.weekdays && plan.weekdays.length > 0) {
      // Sort weekdays according to WEEKDAYS order
      const sorted = [...plan.weekdays].sort((a, b) => {
        const iA = WEEKDAYS.findIndex(w => w.value === a);
        const iB = WEEKDAYS.findIndex(w => w.value === b);
        return iA - iB;
      });
      return sorted.map(w => WEEKDAYS.find(x => x.value === w)?.label).join(', ');
    }
    if (plan.weekday) {
      return WEEKDAYS.find((w) => w.value === plan.weekday)?.label ?? 'Livre';
    }
    return 'Livre';
  }

  function toggleMenu(id) {
    openMenuId = openMenuId === id ? null : id;
  }

  async function handleRemovePlan(id) {
    openMenuId = null;
    if (!confirm('Remover este treino e todos os exercícios dele?')) return;
    await removePlan(id);
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <div class="flex justify-between items-center mb-2">
    <h1 class="text-2xl font-bold text-primary">Treinos</h1>
    <button
      class="bg-primary text-white rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1"
      on:click={() => navigate('training-new')}
    >
      <span class="text-base leading-none">+</span> Novo treino
    </button>
  </div>

  <button class="text-xs text-white/40 mb-6 flex items-center gap-1" on:click={() => navigate('training-metrics')}>
    📊 Ver métricas de desempenho
  </button>

  {#if $plans === undefined}
    <p class="text-sm text-white/40">Carregando...</p>
  {:else if $plans.length === 0}
    <div class="bg-surface rounded-xl p-6 text-center">
      <p class="text-sm text-white/40 mb-1">Nenhum treino cadastrado ainda.</p>
      <p class="text-xs text-white/30">Toque em "+ Novo treino" para criar o primeiro.</p>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each $plans as plan (plan.id)}
        <div class="bg-surface rounded-xl p-3 flex items-center gap-3 relative">
          <button
            class="flex items-center gap-3 flex-1 min-w-0 text-left"
            on:click={() => navigate('workout-plan-detail', { planId: plan.id })}
          >
            <div
              class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-lg"
              style="background: linear-gradient(135deg, #7c5cff, #4c2fc9);"
            >
              🏋️
            </div>
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{plan.name}</h3>
              <p class="text-xs text-white/40">
                {weekdayLabel(plan)}
                {#if plan.focus}· {plan.focus}{/if}
              </p>
            </div>
          </button>

          <button
            class="text-white/40 px-2 py-1 text-lg shrink-0"
            on:click|stopPropagation={() => toggleMenu(plan.id)}
          >
            ⋮
          </button>

          {#if openMenuId === plan.id}
            <div class="absolute right-3 top-14 bg-bg border border-white/10 rounded-lg shadow-lg py-1 z-10 w-32">
              <button
                class="w-full text-left px-3 py-2 text-sm text-danger hover:bg-white/5"
                on:click|stopPropagation={() => handleRemovePlan(plan.id)}
              >
                Remover
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</main>
