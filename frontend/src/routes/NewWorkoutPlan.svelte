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
    navigate('workout-plan-detail', { planId: id, isNew: true });
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <button class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors" on:click={() => navigate('training')}>← Voltar para Treinos</button>
  <h1 class="text-2xl font-black text-white mb-6">Novo treino</h1>

  <form on:submit|preventDefault={createPlan} class="flex flex-col gap-4">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
      <label class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
      <input
        class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-3 text-[12px] font-bold text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 transition-colors"
        placeholder="ex: Treino A - Peito e Tríceps"
        bind:value={name}
        autofocus
      />
    </div>

    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
      <label class="text-[10px] text-[#a855f7] mb-3 block uppercase font-bold tracking-wider">Dias da semana</label>
      <div class="flex flex-wrap gap-2">
        {#each activeDays as day}
          <button
            type="button"
            class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-[10px] border transition-all {weekdays.includes(day.value) ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'}"
            on:click={() => toggleDay(day.value)}
          >
            {day.label}
          </button>
        {/each}
        <button
          type="button"
          class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-[10px] border transition-all {weekdays.length === 0 ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'}"
          on:click={() => weekdays = []}
        >
          Livre
        </button>
      </div>
    </div>

    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
      <label class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Foco (Opcional)</label>
      <input
        class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-3 text-[12px] font-bold text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 transition-colors"
        placeholder="ex: Hipertrofia, Força, Resistência"
        bind:value={focus}
      />
    </div>

    <button
      type="submit"
      class="bg-[#9333EA] text-white rounded-[16px] py-4 font-black text-[13px] mt-2 shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
      disabled={!name.trim()}
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
      CRIAR FICHA DE TREINO
    </button>
  </form>
</main>
