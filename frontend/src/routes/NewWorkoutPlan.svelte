<script>
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';

  let name = '';
  let weekdays = [];
  let focus = '';

  const activeDays = WEEKDAYS.filter(w => w.value !== null);

  function toggleDay(val) {
    if (weekdays.includes(val)) {
      weekdays = weekdays.filter(d => d !== val);
    } else {
      weekdays = [...weekdays, val];
    }
  }

  async function createPlan() {
    if (!name.trim()) return;

    const id = await db.workoutPlans.add({
      name: name.trim(),
      weekdays,
      focus: focus.trim() || null
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

    <div>
      <label class="text-xs text-white/40 mb-2 block">Dias da semana (selecione um ou mais)</label>
      <div class="flex flex-wrap gap-2">
        {#each activeDays as day}
          <button
            type="button"
            class="px-3 py-2 text-xs rounded-lg border transition-colors {weekdays.includes(day.value) ? 'bg-primary border-primary text-white' : 'bg-surface border-white/10 text-white/60'}"
            on:click={() => toggleDay(day.value)}
          >
            {day.label}
          </button>
        {/each}
        <button
          type="button"
          class="px-3 py-2 text-xs rounded-lg border transition-colors {weekdays.length === 0 ? 'bg-primary border-primary text-white' : 'bg-surface border-white/10 text-white/60'}"
          on:click={() => weekdays = []}
        >
          Livre
        </button>
      </div>
    </div>

    <div>
      <label class="text-xs text-white/40 mb-1 block">Foco do treino (ex: Hipertrofia, Força, Peito)</label>
      <input
        class="w-full bg-surface border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Opcional"
        bind:value={focus}
      />
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
