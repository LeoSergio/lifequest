<script>
  import { navigate } from '../lib/nav.js';
  import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../lib/constants.js';
  import {
    workoutPlansQuery,
    exerciseCatalogQuery,
    planSessionsQuery,
    planExerciseLinksQuery,
    allSessionSetsQuery
  } from '../repositories/workoutRepository.js';
  import {
    addExerciseToPlan,
    removeExerciseLink,
    startWorkout,
    persistSet,
    finishWorkout
  } from '../services/workoutService.js';

  export let planId; // recebido via navigate('workout-plan-detail', { planId })

  let exerciseName = '';
  let muscleGroup = MUSCLE_GROUPS[0];
  let equipment = EQUIPMENT_TYPES[0];
  let targetSets = 3;
  let targetReps = '8-12';
  let restSeconds = 90;
  let completing = false;
  let starting = false;
  export let isEditing = false;
  export let isNew = false;

  // Inputs de peso/reps ainda não salvos, por "linkId-numeroDaSerie".
  // Só existe em memória até o usuário tocar em "salvar" naquela série.
  let setInputs = {};

  let completedExercises = {};
  let activeRestLinkId = null;
  let restTimeLeft = 0;
  let restInterval;

  function startRest(linkId, seconds) {
    if (restInterval) clearInterval(restInterval);
    activeRestLinkId = linkId;
    restTimeLeft = seconds;
    restInterval = setInterval(() => {
      restTimeLeft -= 1;
      if (restTimeLeft <= 0) {
        clearInterval(restInterval);
        activeRestLinkId = null;
      }
    }, 1000);
  }

  function stopRest() {
    if (restInterval) clearInterval(restInterval);
    activeRestLinkId = null;
    restTimeLeft = 0;
  }

  const plan = workoutPlansQuery();
  const links = planExerciseLinksQuery(planId);
  const catalog = exerciseCatalogQuery();
  const planSessions = planSessionsQuery(planId);
  const allSessionSets = allSessionSetsQuery();

  $: currentPlan = ($plan ?? []).find((p) => p.id === planId);

  $: exercises = ($links ?? []).map((link) => ({
    ...link,
    exercise: ($catalog ?? []).find((e) => e.id === link.exerciseId) ?? { name: '(exercício removido)' }
  }));

  const today = new Date().toISOString().slice(0, 10);

  $: activeSession = ($planSessions ?? []).find((s) => !s.finishedAt) ?? null;
  $: todaysFinishedSession = ($planSessions ?? []).find((s) => s.finishedAt?.slice(0, 10) === today);

  $: activeSets = activeSession && $allSessionSets
    ? $allSessionSets.filter((s) => s.workoutSessionId === activeSession.id)
    : [];

  function savedSet(linkId, setNumber) {
    return activeSets.find((s) => s.workoutPlanExerciseId === linkId && s.setNumber === setNumber);
  }

    async function handleAddExercise() {
    if (!exerciseName.trim()) return;
    await addExerciseToPlan({
      planId,
      catalog: $catalog ?? [],
      exerciseName,
      muscleGroup,
      equipment,
      targetSets,
      targetReps: 'Livre',
      restSeconds
    });
    exerciseName = '';
    targetSets = 3;
    restSeconds = 90;
  }

  async function handleStartWorkout() {
    starting = true;
    try {
      await startWorkout(planId);
    } finally {
      starting = false;
    }
  }

  async function handleSaveSet(link, setNumber) {
    const key = `${link.id}-${setNumber}`;
    const saved = savedSet(link.id, setNumber);
    const currentInput = setInputs[key] || {};
    
    // Se o usuário não digitou nada novo (setInputs vazio), mantém o valor que já estava salvo (se existir)
    // para não sobrescrever com null acidentalmente caso ele clique no botão novamente.
    let weight = currentInput.weight !== undefined ? currentInput.weight : (saved?.weightKg ?? '');
    let reps = currentInput.reps !== undefined ? currentInput.reps : (saved?.repsDone ?? '');

    await persistSet({ 
      activeSession, 
      activeSets, 
      link, 
      setNumber, 
      input: { weight, reps } 
    });
  }

  async function handleFinishWorkout() {
    if (!activeSession) return;
    completing = true;
    try {
      const { xpReward, leveledUp, level } = await finishWorkout({
        activeSession,
        exercises,
        activeSets,
        setInputs
      });
      if (leveledUp) {
        alert(`Treino concluído! +${xpReward} XP — Level up! Agora você é nível ${level} 🎉`);
      } else {
        alert(`Treino concluído! +${xpReward} XP 🔥`);
      }
    } finally {
      completing = false;
    }
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <button class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors" on:click={() => navigate('training')}>← Voltar para Treinos</button>

  <div class="flex justify-between items-center mb-6">
    {#if currentPlan}
      <h1 class="text-2xl font-black text-white">{currentPlan.name}</h1>
    {/if}

    {#if !activeSession && !todaysFinishedSession && isEditing && !isNew}
      <button 
        class="text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded-[8px] transition-colors border bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]" 
        on:click={() => isEditing = false}
      >
        Concluir Edição
      </button>
    {/if}
  </div>

  {#if !activeSession && !todaysFinishedSession && (isEditing || isNew)}
    <!-- Formulário para adicionar exercício -->
    <h2 class="text-[11px] uppercase text-white/40 mb-3 font-bold tracking-wider flex items-center gap-2">
       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15V9"/><path d="M18 15V9"/><path d="M6 12h12"/><path d="M3 15v-6"/><path d="M21 15v-6"/></svg>
       Adicionar Exercício
    </h2>
    <form on:submit|preventDefault={handleAddExercise} class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 mb-6 flex flex-col gap-3 shadow-inner">
      <input
        class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white focus:border-[#a855f7] outline-none placeholder:text-white/30"
        placeholder="Nome do exercício (ex: Supino reto)"
        bind:value={exerciseName}
      />

      <div class="flex gap-2">
        <select class="flex-1 bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white focus:border-[#a855f7] outline-none" bind:value={muscleGroup}>
          {#each MUSCLE_GROUPS as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
        <select class="flex-1 bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white focus:border-[#a855f7] outline-none" bind:value={equipment}>
          {#each EQUIPMENT_TYPES as eq}
            <option value={eq}>{eq}</option>
          {/each}
        </select>
      </div>

      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[9px] text-[#a855f7] uppercase font-bold tracking-wider mb-1 block" for="target-sets">Séries</label>
          <input id="target-sets" type="number" class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white focus:border-[#a855f7] outline-none text-center" bind:value={targetSets} />
        </div>
        <div class="flex-1">
          <label class="text-[9px] text-[#a855f7] uppercase font-bold tracking-wider mb-1 block" for="rest-seconds">Descanso (s)</label>
          <input id="rest-seconds" type="number" class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white focus:border-[#a855f7] outline-none text-center" bind:value={restSeconds} />
        </div>
      </div>

      <button type="submit" class="bg-[#9333EA] text-white rounded-[12px] py-3 text-[11px] font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:bg-[#a855f7] transition-colors mt-1">Incluir na Ficha</button>
    </form>
  {/if}

  {#if $links === undefined}
    <p class="text-[10px] text-white/40 text-center py-4">Carregando ficha...</p>
  {:else}
    {#if exercises.length === 0 && !isEditing && !isNew}
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-6 text-center shadow-inner mb-6">
         <span class="text-3xl filter grayscale opacity-20 block mb-2">🏋️</span>
         <p class="text-[10px] text-white/40">Ficha vazia. Para adicionar exercícios, edite a ficha nos 3 pontinhos.</p>
      </div>
    {/if}

    {#if exercises.length > 0}
      {#if !activeSession && !todaysFinishedSession}
        <h2 class="text-[11px] uppercase text-white/40 mb-3 font-bold tracking-wider flex items-center gap-2">
           <svg class="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
           Sua Ficha
        </h2>
        <div class="flex flex-col gap-2 mb-6">
          {#each exercises as link (link.id)}
            <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4 flex justify-between items-center shadow-inner">
              <div>
                <h3 class="text-[12px] font-bold text-white mb-0.5">{link.exercise.name}</h3>
                <p class="text-[9px] text-white/40">
                  <span class="text-[#a855f7] font-bold">{link.exercise.muscleGroup}</span> · {link.exercise.equipment} · <span class="text-white/60">{link.targetSets} séries</span> · {link.restSeconds}s desc.
                </p>
              </div>
              {#if isEditing || isNew}
                <button class="text-white/20 text-sm shrink-0 hover:text-red-400 transition-colors p-1" on:click={() => removeExerciseLink(link.id)}>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

    {#if todaysFinishedSession}
      <div class="bg-green-500/10 border border-green-500/30 rounded-[20px] p-5 text-center text-green-400 mb-4 shadow-inner">
        <span class="text-xl block mb-1">✅</span>
        <span class="text-[12px] font-bold">Treino concluído por hoje!</span>
      </div>
      <button
        class="w-full bg-[#1C1C22]/80 border border-white/10 text-white/80 rounded-[12px] py-3 text-[11px] font-bold hover:bg-white/5 hover:text-white transition-colors"
        on:click={() => navigate('training-metrics', { focusPlanId: planId })}
      >
        Ver evolução deste treino →
      </button>
    {:else if activeSession}
      <div class="mb-4">
        <div class="flex items-center justify-center gap-2 mb-4">
           <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
           <h2 class="text-[11px] uppercase font-bold text-white/60 tracking-wider text-center">Sessão em andamento</h2>
        </div>

        <div class="flex flex-col gap-4 mb-6">
          {#each exercises as link (link.id)}
            <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner transition-colors {completedExercises[link.id] ? 'opacity-60 border-green-500/20' : ''}">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-[14px] font-bold {completedExercises[link.id] ? 'text-green-400' : 'text-white'}">{link.exercise.name}</h3>
                <span class="text-[9px] uppercase font-bold text-white/40 tracking-wider bg-white/5 px-2 py-1 rounded-[8px] border border-white/5">
                  {link.targetSets} Séries
                </span>
              </div>
              
              {#if !completedExercises[link.id]}
                <!-- Tabela de Séries -->
                <div class="flex flex-col gap-2.5">
                  <!-- Cabeçalho -->
                  <div class="flex items-center text-[9px] uppercase font-bold text-[#a855f7] mb-1 px-1">
                    <div class="w-10 text-center">Série</div>
                    <div class="flex-1 text-center">Carga (kg)</div>
                    <div class="flex-1 text-center">Reps</div>
                  </div>

                  {#each Array(link.targetSets) as _, i}
                    {@const setNumber = i + 1}
                    {@const saved = savedSet(link.id, setNumber)}
                    {@const key = `${link.id}-${setNumber}`}
                    <div class="flex items-center gap-2 p-1.5 rounded-[12px] bg-white/5 border border-white/5">
                      <!-- Set Number -->
                      <div class="w-10 text-center font-black text-[12px] text-white/40">
                        {setNumber}
                      </div>
                      
                      <!-- Weight Input -->
                      <div class="flex-1 relative">
                        <input
                          type="number"
                          class="w-full bg-[#1C1C22]/80 border border-white/10 rounded-[8px] px-2 py-2.5 text-center text-[12px] font-bold focus:border-[#a855f7] outline-none transition-colors text-white placeholder:text-white/20"
                          placeholder="-"
                          value={setInputs[key]?.weight ?? (saved?.weightKg ?? '')}
                          on:input={(e) => (setInputs[key] = { ...setInputs[key], weight: e.target.value })}
                        />
                      </div>

                      <!-- Reps Input -->
                      <div class="flex-1 relative">
                        <input
                          type="number"
                          class="w-full bg-[#1C1C22]/80 border border-white/10 rounded-[8px] px-2 py-2.5 text-center text-[12px] font-bold focus:border-[#a855f7] outline-none transition-colors text-white placeholder:text-white/20"
                          placeholder="Reps"
                          value={setInputs[key]?.reps ?? (saved?.repsDone ?? '')}
                          on:input={(e) => (setInputs[key] = { ...setInputs[key], reps: e.target.value })}
                        />
                      </div>
                    </div>
                  {/each}
                </div>

                <div class="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                  <button class="w-full bg-white/5 border border-white/10 text-white/80 rounded-[12px] py-2.5 text-[11px] font-bold hover:bg-white/10 hover:text-white transition-colors" on:click={() => completedExercises[link.id] = true}>
                    Ocultar este Exercício
                  </button>
                </div>
              {:else}
                <div class="flex flex-col gap-3">
                  {#if activeRestLinkId === link.id}
                    <div class="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-[12px] p-4 shadow-inner">
                      <div class="flex items-center gap-3">
                        <span class="text-2xl filter drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]">⏳</span>
                        <div>
                          <p class="text-[9px] text-orange-400 uppercase font-bold tracking-wider mb-0.5">Descanso</p>
                          <p class="text-3xl font-black text-white leading-none">
                            {Math.floor(restTimeLeft / 60).toString().padStart(2, '0')}:{(restTimeLeft % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                      <button class="bg-[#1C1C22]/80 border border-white/10 text-white/50 px-4 py-2 rounded-[10px] text-[10px] font-bold hover:text-white hover:bg-white/5 transition-colors" on:click={stopRest}>
                        Pular
                      </button>
                    </div>
                  {:else}
                    <button class="w-full bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-[12px] py-3 text-[11px] font-bold hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2" on:click={() => startRest(link.id, link.restSeconds)}>
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Iniciar Descanso ({link.restSeconds}s)
                    </button>
                  {/if}
                  
                  <button class="text-[10px] text-white/40 font-bold hover:text-white/70 uppercase tracking-wider text-center py-2" on:click={() => completedExercises[link.id] = false}>
                    Reabrir exercício
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Botão ÚNICO de encerrar sessão, posicionado apenas no final -->
        <button class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-[16px] py-4 text-[13px] font-black shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 mt-8 mb-6" on:click={handleFinishWorkout}>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ENCERRAR SESSÃO COMPLETA
        </button>
      </div>
    {:else}
      <button
        class="w-full bg-[#9333EA] text-white rounded-[16px] py-4 font-black text-[13px] shadow-[0_0_20px_rgba(147,51,234,0.4)] disabled:opacity-50 hover:bg-[#a855f7] transition-all flex items-center justify-center gap-2"
        disabled={starting}
        on:click={handleStartWorkout}
      >
        {#if starting}
           <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Iniciando...
        {:else}
           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> INICIAR TREINO
        {/if}
      </button>
    {/if}
  {/if}
  {/if}
</main>
