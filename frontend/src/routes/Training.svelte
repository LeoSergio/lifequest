<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';

  let name = '';
  let weekday = null;
  let estimatedDuration = '';
  let showForm = false;

  const plans = liveQuery(() => db.workoutPlans.toArray());

  function weekdayLabel(value) {
    return WEEKDAYS.find((w) => w.value === value)?.label ?? 'Livre';
  }

  async function createPlan() {
    if (!name.trim()) return;

    await db.workoutPlans.add({
      name: name.trim(),
      weekday,
      estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null
    });

    name = '';
    weekday = null;
    estimatedDuration = '';
    showForm = false;
  }

  async function removePlan(id, event) {
    event.stopPropagation(); // não deixa o clique "vazar" pro card e abrir o detalhe
    if (!confirm('Remover este treino e todos os exercícios dele?')) return;

    // Remove o plano e os exercícios ligados a ele (limpeza em cascata manual,
    // já que o Dexie não faz isso sozinho como um banco relacional faria).
    await db.transaction('rw', db.workoutPlans, db.workoutPlanExercises, async () => {
      await db.workoutPlans.delete(id);
      await db.workoutPlanExercises.where('workoutPlanId').equals(id).delete();
    });
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-primary">Treinos</h1>
    <button class="bg-primary text-white rounded-lg px-3 py-2 text-sm" on:click={() => (showForm = !showForm)}>
      {showForm ? 'Cancelar' : '+ Novo'}
    </button>
  </div>

  {#if showForm}
    <form on:submit|preventDefault={createPlan} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
      <input
        class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Nome (ex: Treino A - Peito e Tríceps)"
        bind:value={name}
      />
      <div class="flex gap-2">
        <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={weekday}>
          {#each WEEKDAYS as w}
            <option value={w.value}>{w.label}</option>
          {/each}
        </select>
        <input
          class="w-32 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="Min (opc.)"
          type="number"
          bind:value={estimatedDuration}
        />
      </div>
      <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">Criar treino</button>
    </form>
  {/if}

  {#if $plans === undefined}
    <p class="text-sm text-white/40">Carregando...</p>
  {:else if $plans.length === 0}
    <p class="text-sm text-white/40">Nenhum treino cadastrado ainda.</p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each $plans as plan (plan.id)}
        <button
          class="bg-surface rounded-xl p-4 text-left flex justify-between items-center"
          on:click={() => navigate('workout-plan-detail', { planId: plan.id })}
        >
          <div>
            <h3 class="font-semibold">{plan.name}</h3>
            <p class="text-xs text-white/40">
              {weekdayLabel(plan.weekday)}
              {#if plan.estimatedDuration}· ~{plan.estimatedDuration} min{/if}
            </p>
          </div>
          <span class="text-white/40 text-sm" on:click={(e) => removePlan(plan.id, e)} role="button" tabindex="0">
            remover
          </span>
        </button>
      {/each}
    </div>
  {/if}
</main>
