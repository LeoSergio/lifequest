<script>
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';

  let name = '';
  let weekday = null;
  let estimatedDuration = '';

  async function createPlan() {
    if (!name.trim()) return;

    const id = await db.workoutPlans.add({
      name: name.trim(),
      weekday,
      estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null
    });

    navigate('workout-plan-detail', { planId: id });
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <button class="text-sm text-white/40 mb-4" on:click={() => navigate('training')}>← Treinos</button>
  <h1 class="text-2xl font-bold text-primary mb-6">Novo treino</h1>

  <form on:submit|preventDefault={createPlan} class="flex flex-col gap-4">
    <div>
      <label class="text-xs text-white/40 mb-1 block">Nome do treino</label>
      <input
        class="w-full bg-surface border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="ex: Treino A - Peito e Tríceps"
        bind:value={name}
        autofocus
      />
    </div>

    <div class="flex gap-3">
      <div class="flex-1">
        <label class="text-xs text-white/40 mb-1 block">Dia da semana</label>
        <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={weekday}>
          {#each WEEKDAYS as w}
            <option value={w.value}>{w.label}</option>
          {/each}
        </select>
      </div>
      <div class="w-28">
        <label class="text-xs text-white/40 mb-1 block">Duração (min)</label>
        <input
          type="number"
          class="w-full bg-surface border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="60"
          bind:value={estimatedDuration}
        />
      </div>
    </div>

    <button
      type="submit"
      class="bg-primary text-white rounded-xl py-4 font-semibold mt-2 disabled:opacity-40"
      disabled={!name.trim()}
    >
      Criar treino
    </button>
  </form>
</main>
