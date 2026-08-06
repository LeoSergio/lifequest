<script>
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';
  import { enqueue, pushSync } from '../services/syncService.js';
  import { liveQuery } from 'dexie';
  import { isPro } from '../lib/pro.js';
  import { api } from '../lib/api.js';
  import { showAlert } from '../lib/modal.js';

  let name = '';
  let weekdays = [];
  let focus = '';
  let aiGoalInput = '';
  let isLoadingAI = false;

  const player = liveQuery(() => db.player.toCollection().first());
  $: userIsPro = $player ? isPro($player) : false;

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

    const plan = {
      id: generateId(),
      name: name.trim(),
      weekday: JSON.stringify(weekdays),
    };
    await db.workoutPlans.put(plan);
    await enqueue('upsert', 'workoutPlans', plan.id, plan);
    pushSync().catch(() => {});

    navigate('workout-plan-detail', { planId: plan.id, isNew: true });
  }

  async function handleAISuggestWorkout() {
    if (!aiGoalInput.trim() || isLoadingAI) return;
    isLoadingAI = true;
    try {
      const result = await api.generateWorkoutFeedback({
        exercise_name: 'treino completo',
        last_feedback: aiGoalInput.trim(),
        current_sets: 3,
        current_reps: '8-12',
        current_weight_kg: null
      });
      // A IA retorna sugestão de treino — usamos rationale como nome sugerido
      if (result?.rationale) {
        name = name || `Treino IA - ${aiGoalInput.trim().slice(0, 20)}`;
        focus = aiGoalInput.trim();
        showAlert({
          title: '🤖 Sugestão da IA',
          message: result.rationale,
          icon: '💪',
          type: 'success',
          confirmText: 'Criar ficha com isso!'
        });
      }
    } catch (e) {
      console.error('[IA] Erro ao sugerir treino:', e);
      showAlert({ title: 'Erro', message: 'Não foi possível consultar a IA. Tente novamente.', icon: '📡', type: 'warning' });
    } finally {
      isLoadingAI = false;
    }
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <button class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors" on:click={() => navigate('training')}>← Voltar para Treinos</button>
  <h1 class="text-2xl font-black text-white mb-6">Novo treino</h1>

  <!-- Bloco IA PRO -->
  <div class="mb-5 rounded-[20px] overflow-hidden border {userIsPro ? 'border-purple-500/30 bg-purple-500/5' : 'border-white/5 bg-[#1C1C22]/60'}">
    <div class="p-4 flex items-center gap-3">
      <div class="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 {userIsPro ? 'bg-purple-500/20' : 'bg-white/5'}">
        <svg class="w-5 h-5 {userIsPro ? 'text-purple-400' : 'text-white/20'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-bold {userIsPro ? 'text-purple-300' : 'text-white/40'} leading-tight">
          Sugestão de Treino por IA
          {#if !userIsPro}<span class="ml-1 text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">PRO</span>{/if}
        </p>
        <p class="text-[9px] {userIsPro ? 'text-white/50' : 'text-white/25'} leading-relaxed mt-0.5">
          {#if userIsPro}
            Descreva seu objetivo e a IA monta uma sugestão de treino.
          {:else}
            Disponível apenas para assinantes PRO.
          {/if}
        </p>
      </div>
    </div>

    {#if userIsPro}
      <div class="px-4 pb-4 flex flex-col gap-2">
        <textarea
          class="w-full bg-[#1C1C22]/80 border border-purple-500/20 rounded-[12px] px-3 py-2.5 text-[11px] text-white focus:border-purple-400 outline-none resize-none placeholder:text-white/30 transition-colors"
          rows="2"
          placeholder="Ex: quero focar em hipertrofia de peito e tríceps, tenho halteres e barra..."
          bind:value={aiGoalInput}
        ></textarea>
        <button
          on:click={handleAISuggestWorkout}
          disabled={!aiGoalInput.trim() || isLoadingAI}
          class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] py-2.5 rounded-[12px] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
        >
          {#if isLoadingAI}
            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Consultando IA...
          {:else}
            🤖 Pedir sugestão à IA
          {/if}
        </button>
      </div>
    {:else}
      <div class="px-4 pb-4">
        <div class="bg-white/3 border border-white/5 rounded-[12px] p-3 flex items-center gap-3 opacity-60">
          <span class="text-lg">🔒</span>
          <p class="text-[10px] text-white/40 leading-relaxed">
            Assine o <strong class="text-purple-400">LifeQuest PRO</strong> para deixar a IA montar seu treino com base no seu objetivo.
          </p>
        </div>
      </div>
    {/if}
  </div>

  <form on:submit|preventDefault={createPlan} class="flex flex-col gap-4">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
      <label for="plan-name" class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
      <input
        id="plan-name"
        class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-3 text-[12px] font-bold text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 transition-colors"
        placeholder="ex: Treino A - Peito e Tríceps"
        bind:value={name}
      />
    </div>

    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
      <label for="plan-weekdays" class="text-[10px] text-[#a855f7] mb-3 block uppercase font-bold tracking-wider">Dias da semana</label>
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
      <label for="plan-focus" class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Foco (Opcional)</label>
      <input
        id="plan-focus"
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

