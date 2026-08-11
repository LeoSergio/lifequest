<script>
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS, EQUIPMENT_TYPES } from '../lib/constants.js';
  import { enqueue, pushSync } from '../services/syncService.js';
  import { api } from '../lib/api.js';
  import { addExerciseToPlan } from '../services/workoutService.js';

  let name = '';
  let weekdays = [];
  let isLoadingAI = false;

  // ── Wizard de IA ───────────────────────────────────────────────────────────
  let aiGoal = '';
  let aiLevel = 'intermediario';
  let aiDuration = 60;
  let aiEquipment = [];

  // Resultado da IA
  let aiResult = null; // { plan_name, exercises, rationale }
  let aiError = null;

  const activeDays = WEEKDAYS.filter(w => w.value !== null);

  function toggleDay(val) {
    if (weekdays.includes(val)) {
      weekdays = weekdays.filter(d => d !== val);
    } else {
      weekdays = [...weekdays, val];
    }
  }

  function toggleEquipment(val) {
    if (aiEquipment.includes(val)) {
      aiEquipment = aiEquipment.filter(e => e !== val);
    } else {
      aiEquipment = [...aiEquipment, val];
    }
  }

  async function handleGenerateAI() {
    if (!aiGoal.trim() || isLoadingAI) return;
    isLoadingAI = true;
    aiError = null;
    aiResult = null;
    try {
      const result = await api.generateWorkoutPlan({
        goal: aiGoal.trim(),
        equipment: aiEquipment,
        level: aiLevel,
        days_per_week: weekdays.length > 0 ? weekdays.length : 3,
        session_duration_min: aiDuration,
      });
      aiResult = result;
      name = result.plan_name;
    } catch (e) {
      console.error('[IA] Erro ao gerar plano:', e);
      aiError = 'Não foi possível gerar a ficha. Verifique sua conexão e tente novamente.';
    } finally {
      isLoadingAI = false;
    }
  }

  function resetAI() {
    aiResult = null;
    aiError = null;
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

    // Se veio da IA, cria os exercícios automaticamente
    if (aiResult?.exercises?.length) {
      const catalog = await db.exercises.toArray();
      for (const ex of aiResult.exercises) {
        await addExerciseToPlan({
          planId: plan.id,
          catalog,
          exerciseName: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment,
          targetSets: ex.sets,
          targetReps: 'Livre',
          restSeconds: ex.rest_seconds,
        });
      }
    }

    pushSync().catch(() => {});
    navigate('workout-plan-detail', { planId: plan.id, isNew: !aiResult });
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <button class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors" on:click={() => navigate('training')}>← Voltar para Treinos</button>
  <h1 class="text-2xl font-black text-white mb-6">Novo treino</h1>

  <!-- ── Bloco IA ───────────────────────────────────────────────────────────── -->
  <div class="mb-5 rounded-[20px] overflow-hidden border border-purple-500/30 bg-purple-500/5">
    <div class="p-4 flex items-center gap-3">
      <div class="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 bg-purple-500/20">
        <svg class="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-bold text-purple-300 leading-tight">Gerar Ficha com IA</p>
        <p class="text-[9px] text-white/50 leading-relaxed mt-0.5">Descreva seu objetivo e a IA monta a ficha completa com exercícios.</p>
      </div>
    </div>

    {#if aiResult}
      <!-- ── Preview do Resultado ───────────────────────────────────── -->
      <div class="px-4 pb-4 flex flex-col gap-3">
        <div class="bg-green-500/10 border border-green-500/20 rounded-[14px] p-4">
          <p class="text-[10px] text-green-400 uppercase font-bold tracking-wider mb-1">✅ Ficha gerada pela IA</p>
          <p class="text-[13px] font-black text-white mb-2">{aiResult.plan_name}</p>
          <p class="text-[10px] text-white/50 mb-3 leading-relaxed">{aiResult.rationale}</p>
          <div class="flex flex-col gap-2">
            {#each aiResult.exercises as ex}
              <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                  <p class="text-[9px] text-[#a855f7] font-medium truncate">{ex.muscle_group} · {ex.equipment}</p>
                </div>
                <span class="text-[9px] text-white/40 font-bold shrink-0">{ex.sets} séries · {ex.rest_seconds}s</span>
              </div>
            {/each}
          </div>
        </div>
        <button
          class="w-full bg-gradient-to-r from-[#9333EA] to-[#7c3aed] text-white rounded-[14px] py-3.5 text-[12px] font-black shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          on:click={createPlan}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          SALVAR FICHA E IR PARA OS TREINOS
        </button>
        <button class="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider text-center" on:click={resetAI}>
          Gerar nova sugestão
        </button>
      </div>
    {:else}
      <!-- ── Formulário IA ───────────────────────────────────────────── -->
      <div class="px-4 pb-4 flex flex-col gap-3">
          <textarea
            class="w-full bg-[#1C1C22]/80 border border-purple-500/20 rounded-[12px] px-3 py-2.5 text-[11px] text-white focus:border-purple-400 outline-none resize-none placeholder:text-white/30 transition-colors"
            rows="2"
            placeholder="Ex: hipertrofia de peito e tríceps, foco em força..."
            bind:value={aiGoal}
          ></textarea>

          <!-- Equipamentos -->
          <div>
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Equipamentos disponíveis</p>
            <div class="flex flex-wrap gap-1.5">
              {#each EQUIPMENT_TYPES as eq}
                <button
                  type="button"
                  class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {aiEquipment.includes(eq) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
                  on:click={() => toggleEquipment(eq)}
                >{eq}</button>
              {/each}
            </div>
          </div>

          <!-- Nível + Dias + Duração -->
          <div class="flex gap-2">
            <div class="flex-1">
              <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5">Nível</p>
              <select class="w-full bg-white/5 border border-white/10 rounded-[10px] px-2 py-2 text-[10px] text-white outline-none focus:border-purple-400 transition-colors" bind:value={aiLevel}>
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Interm.</option>
                <option value="avancado">Avançado</option>
              </select>
            </div>
            <div class="flex-1">
              <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5">Duração</p>
              <select class="w-full bg-white/5 border border-white/10 rounded-[10px] px-2 py-2 text-[10px] text-white outline-none focus:border-purple-400 transition-colors" bind:value={aiDuration}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
          </div>

          <!-- Dias da Semana -->
          <div>
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Dias da semana</p>
            <div class="flex flex-wrap gap-1.5">
              {#each activeDays as day}
                <button
                  type="button"
                  class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.includes(day.value) ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
                  on:click={() => toggleDay(day.value)}
                >{day.label}</button>
              {/each}
              <button
                type="button"
                class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.length === 0 ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
                on:click={() => weekdays = []}
              >Livre</button>
            </div>
          </div>

          {#if aiError}
            <p class="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-[10px] px-3 py-2">{aiError}</p>
          {/if}

          <button
            on:click={handleGenerateAI}
            disabled={!aiGoal.trim() || isLoadingAI}
            class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] py-3 rounded-[12px] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            {#if isLoadingAI}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Gerando sua ficha...
            {:else}
              🤖 Gerar Ficha Completa com IA
            {/if}
          </button>
        </div>
      {/if}
  </div>

  <!-- ── Formulário Manual ──────────────────────────────────────────────────── -->
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

    <button
      type="submit"
      class="bg-[#9333EA] text-white rounded-[16px] py-4 font-black text-[13px] mt-2 shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
      disabled={!name.trim()}
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
      {aiResult ? 'CRIAR FICHA COM EXERCÍCIOS DA IA' : 'CRIAR FICHA DE TREINO'}
    </button>
  </form>
</main>
