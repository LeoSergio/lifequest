<script>
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS, EQUIPMENT_TYPES } from '../lib/constants.js';
  import { enqueue, pushSync } from '../services/syncService.js';
  import { api } from '../lib/api.js';
  import { addExerciseToPlan } from '../services/workoutService.js';

  // ── Controle de modo ─────────────────────────────────────────────────────────
  // null = tela de seleção | 'scan' | 'ai' | 'manual'
  let mode = null;

  let name = '';
  let weekdays = [];

  // ── Estado: IA de texto ──────────────────────────────────────────────────────
  let isLoadingAI = false;
  let aiGoal = '';
  let aiLevel = 'intermediario';
  let aiDuration = 60;
  let aiEquipment = [];
  let aiResult = null;
  let aiError = null;

  // ── Estado: Scan por Foto ────────────────────────────────────────────────────
  let isScanningSheet = false;
  let scanResult = null;
  let scanError = null;
  let scanPreviewUrl = null;

  const activeDays = WEEKDAYS.filter(w => w.value !== null);

  function selectMode(m) {
    mode = m;
    aiResult = null; aiError = null;
    scanResult = null; scanError = null; scanPreviewUrl = null;
    name = '';
    weekdays = [];
  }

  function toggleDay(val) {
    weekdays = weekdays.includes(val)
      ? weekdays.filter(d => d !== val)
      : [...weekdays, val];
  }

  function toggleEquipment(val) {
    aiEquipment = aiEquipment.includes(val)
      ? aiEquipment.filter(e => e !== val)
      : [...aiEquipment, val];
  }

  async function handleScanSheet(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      scanError = 'Imagem muito grande. Use uma foto com menos de 20 MB.';
      return;
    }

    isScanningSheet = true;
    scanError = null;
    scanResult = null;
    scanPreviewUrl = URL.createObjectURL(file);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await api.scanWorkoutSheet(base64, file.type);
      scanResult = result;
      if (result.plan_name_suggestion) name = result.plan_name_suggestion;
    } catch (e) {
      console.error('[Scan] Erro ao analisar ficha:', e);
      scanError = 'Não foi possível analisar a imagem. Verifique sua conexão e tente novamente.';
      scanPreviewUrl = null;
    } finally {
      isScanningSheet = false;
      event.target.value = '';
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

  async function createPlan(goToEdit = false) {
    if (!name.trim()) return;

    const plan = {
      id: generateId(),
      name: name.trim(),
      weekday: JSON.stringify(weekdays),
    };
    await db.workoutPlans.put(plan);
    await enqueue('upsert', 'workoutPlans', plan.id, plan);

    const exercisesToSave = scanResult?.exercises ?? aiResult?.exercises;

    if (exercisesToSave?.length) {
      const catalog = await db.exercises.toArray();
      for (const ex of exercisesToSave) {
        await addExerciseToPlan({
          planId: plan.id,
          catalog,
          exerciseName: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment ?? 'Livre',
          targetSets: ex.sets,
          targetReps: ex.reps ?? 'Livre',
          restSeconds: ex.rest_seconds,
        });
      }
    }

    pushSync().catch(() => {});
    navigate('workout-plan-detail', {
      planId: plan.id,
      isEditing: goToEdit === true,
      isNew: !scanResult && !aiResult,
    });
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">

  <!-- Cabeçalho -->
  <button
    class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors"
    on:click={() => mode ? selectMode(null) : navigate('training')}
  >
    {`← ${mode ? 'Escolher outro modo' : 'Voltar para Treinos'}`}
  </button>

  <h1 class="text-2xl font-black text-white mb-1">Novo treino</h1>
  <p class="text-[11px] text-white/40 mb-6">
    {mode === null ? 'Como você quer criar sua ficha?' : mode === 'scan' ? '📸 Importar ficha por foto' : mode === 'ai' ? '🤖 Gerar ficha com IA' : '✏️ Criar manualmente'}
  </p>

  <!-- TELA DE SELEÇÃO -->
  {#if mode === null}
    <div class="flex flex-col gap-3">

      <button
        class="w-full text-left bg-[#0f172a] border border-blue-500/30 rounded-[20px] p-5 flex items-center gap-4 hover:border-blue-400/60 hover:bg-blue-500/5 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('scan')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-blue-500/15 group-hover:bg-blue-500/25 transition-colors">
          <svg class="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Importar ficha por foto</p>
          <p class="text-[10px] text-white/50 mt-1">Fotografe a ficha do seu personal e a IA lê os exercícios automaticamente</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button
        class="w-full text-left bg-[#0f172a] border border-purple-500/30 rounded-[20px] p-5 flex items-center gap-4 hover:border-purple-400/60 hover:bg-purple-500/5 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('ai')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-purple-500/15 group-hover:bg-purple-500/25 transition-colors">
          <svg class="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Gerar ficha com IA</p>
          <p class="text-[10px] text-white/50 mt-1">Descreva seu objetivo e a IA monta a ficha completa com exercícios</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button
        class="w-full text-left bg-[#0f172a] border border-white/10 rounded-[20px] p-5 flex items-center gap-4 hover:border-white/25 hover:bg-white/3 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('manual')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-white/5 group-hover:bg-white/10 transition-colors">
          <svg class="w-6 h-6 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Criar manualmente</p>
          <p class="text-[10px] text-white/50 mt-1">Dê um nome e adicione os exercícios um a um</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

  <!-- MODO: SCAN POR FOTO -->
  {:else if mode === 'scan'}

    {#if scanResult}
      <div class="flex flex-col gap-3">
        <div class="bg-blue-500/10 border border-blue-500/20 rounded-[20px] p-4">
          <p class="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-1">📷 {scanResult.exercises.length} exercícios detectados</p>
          {#if scanPreviewUrl}
            <img src={scanPreviewUrl} alt="Foto da ficha" class="w-full rounded-[12px] my-3 max-h-48 object-cover opacity-75" />
          {/if}
          <div class="flex flex-col gap-2 mt-1">
            {#each scanResult.exercises as ex, i}
              <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2.5">
                <span class="text-[10px] text-white/30 font-bold w-5 shrink-0">{i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                  <p class="text-[9px] text-blue-400 font-medium">{ex.muscle_group}</p>
                </div>
                <span class="text-[9px] text-white/40 font-bold shrink-0">{ex.sets}x{ex.reps}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
          <label class="text-[10px] text-blue-400 mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
          <input
            class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[12px] font-bold text-white focus:border-blue-400 outline-none placeholder:text-white/30 transition-colors"
            placeholder="ex: Treino A — Peito e Costas"
            bind:value={name}
          />
        </div>

        <button
          class="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[16px] py-4 text-[12px] font-black shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
          on:click={() => createPlan(false)}
          disabled={!name.trim()}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          SALVAR FICHA
        </button>
        <button class="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider text-center py-1" on:click={() => { scanResult = null; scanPreviewUrl = null; }}>
          Usar outra foto
        </button>
      </div>

    {:else}
      <div class="flex flex-col gap-3">
        {#if scanPreviewUrl && isScanningSheet}
          <div class="relative rounded-[16px] overflow-hidden">
            <img src={scanPreviewUrl} alt="Processando..." class="w-full max-h-52 object-cover opacity-40" />
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div class="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-[11px] font-bold text-blue-300">Analisando ficha com IA...</p>
              <p class="text-[9px] text-white/40">Isso pode levar alguns segundos</p>
            </div>
          </div>
        {/if}

        {#if scanError}
          <p class="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3">{scanError}</p>
        {/if}

        <label class="w-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-black text-[14px] py-6 rounded-[20px] transition-colors flex flex-col items-center justify-center gap-3 shadow-[0_0_25px_rgba(59,130,246,0.3)] {isScanningSheet ? 'opacity-50 pointer-events-none' : ''}">
          <svg class="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {isScanningSheet ? 'Analisando...' : 'Fotografar ou Importar Ficha'}
          <input type="file" accept="image/*" capture="environment" class="hidden" on:change={handleScanSheet} disabled={isScanningSheet} />
        </label>
        <p class="text-[9px] text-white/30 text-center">Aceita fotos, capturas de tela ou fichas impressas · Máx 20 MB</p>
      </div>
    {/if}

  <!-- MODO: GERAR COM IA -->
  {:else if mode === 'ai'}

    {#if aiResult}
      <div class="flex flex-col gap-3">
        <div class="bg-green-500/10 border border-green-500/20 rounded-[20px] p-4">
          <p class="text-[10px] text-green-400 uppercase font-bold tracking-wider mb-1">✅ Ficha gerada pela IA</p>
          <p class="text-[13px] font-black text-white mb-1">{aiResult.plan_name}</p>
          <p class="text-[10px] text-white/40 leading-relaxed mb-3">{aiResult.rationale}</p>
          <div class="flex flex-col gap-2">
            {#each aiResult.exercises as ex}
              <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                  <p class="text-[9px] text-purple-400 font-medium">{ex.muscle_group} · {ex.equipment}</p>
                </div>
                <span class="text-[9px] text-white/40 font-bold shrink-0">{ex.sets} séries</span>
                <a
                  href={`https://www.youtube.com/results?search_query=como+fazer+${encodeURIComponent(ex.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  class="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-400 transition-colors shrink-0"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33zM9.75 15.02V8.48l6.5 3.27-6.5 3.27z"/></svg>
                </a>
              </div>
            {/each}
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="flex-1 bg-gradient-to-r from-[#9333EA] to-[#7c3aed] text-white rounded-[14px] py-3.5 text-[12px] font-black shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform"
            on:click={() => createPlan(false)}
          >SALVAR FICHA</button>
          <button
            class="px-4 py-3.5 bg-white/5 border border-white/10 text-white/60 rounded-[14px] text-[10px] font-bold hover:bg-white/10 transition-colors"
            on:click={() => createPlan(true)}
          >Editar</button>
        </div>
        <button class="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider text-center py-1" on:click={() => { aiResult = null; aiError = null; }}>
          Gerar nova sugestão
        </button>
      </div>

    {:else}
      <div class="flex flex-col gap-4">
        <textarea
          class="w-full bg-[#1C1C22]/80 border border-purple-500/20 rounded-[16px] px-4 py-3.5 text-[12px] text-white focus:border-purple-400 outline-none resize-none placeholder:text-white/30 transition-colors"
          rows="3"
          placeholder="Ex: hipertrofia de peito e tríceps, foco em força e volume..."
          bind:value={aiGoal}
        ></textarea>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
          <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Equipamentos disponíveis</p>
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

        <div class="grid grid-cols-2 gap-2">
          <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3">
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Nível</p>
            <select class="w-full bg-transparent text-[11px] text-white outline-none" bind:value={aiLevel}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3">
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Duração</p>
            <select class="w-full bg-transparent text-[11px] text-white outline-none" bind:value={aiDuration}>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </div>
        </div>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
          <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Dias da semana (opcional)</p>
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
          <p class="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3">{aiError}</p>
        {/if}

        <button
          on:click={handleGenerateAI}
          disabled={!aiGoal.trim() || isLoadingAI}
          class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-[13px] py-4 rounded-[16px] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
        >
          {#if isLoadingAI}
            <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Gerando sua ficha...
          {:else}
            🤖 Gerar Ficha Completa
          {/if}
        </button>
      </div>
    {/if}

  <!-- MODO: MANUAL -->
  {:else if mode === 'manual'}
    <div class="flex flex-col gap-4">
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
        <label for="plan-name" class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
        <input
          id="plan-name"
          class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-3 text-[13px] font-bold text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 transition-colors"
          placeholder="ex: Treino A — Peito e Tríceps"
          bind:value={name}
        />
      </div>

      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
        <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Dias da semana (opcional)</p>
        <div class="flex flex-wrap gap-1.5">
          {#each activeDays as day}
            <button
              type="button"
              class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.includes(day.value) ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
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

      <button
        on:click={() => createPlan(true)}
        disabled={!name.trim()}
        class="w-full bg-[#9333EA] text-white rounded-[16px] py-4 font-black text-[13px] shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        CRIAR E ADICIONAR EXERCÍCIOS
      </button>
    </div>
  {/if}

</main>
