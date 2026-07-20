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
      targetReps,
      restSeconds
    });
    exerciseName = '';
    targetSets = 3;
    targetReps = '8-12';
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

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <button class="text-sm text-white/40 mb-4" on:click={() => navigate('training')}>← Treinos</button>

  {#if currentPlan}
    <h1 class="text-2xl font-bold text-primary mb-6">{currentPlan.name}</h1>
  {/if}

  <form on:submit|preventDefault={handleAddExercise} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
    <input
      class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
      placeholder="Nome do exercício (ex: Supino reto)"
      bind:value={exerciseName}
    />

    <div class="flex gap-2">
      <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" bind:value={muscleGroup}>
        {#each MUSCLE_GROUPS as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
      <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" bind:value={equipment}>
        {#each EQUIPMENT_TYPES as eq}
          <option value={eq}>{eq}</option>
        {/each}
      </select>
    </div>

    <div class="flex gap-2">
      <div class="flex-1">
        <label class="text-xs text-white/40" for="target-sets">Séries</label>
        <input id="target-sets" type="number" class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={targetSets} />
      </div>
      <div class="flex-1">
        <label class="text-xs text-white/40" for="target-reps">Reps</label>
        <input id="target-reps" class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={targetReps} />
      </div>
      <div class="flex-1">
        <label class="text-xs text-white/40" for="rest-seconds">Descanso (s)</label>
        <input id="rest-seconds" type="number" class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={restSeconds} />
      </div>
    </div>

    <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">Adicionar exercício</button>
  </form>

  {#if $links === undefined}
    <p class="text-sm text-white/40">Carregando...</p>
  {:else if exercises.length === 0}
    <p class="text-sm text-white/40">Nenhum exercício ainda. Adicione o primeiro acima.</p>
  {:else}
    <div class="flex flex-col gap-2 mb-6">
      {#each exercises as link (link.id)}
        <div class="bg-surface rounded-lg p-3 flex justify-between items-center">
          <div>
            <h3 class="text-sm font-semibold">{link.exercise.name}</h3>
            <p class="text-xs text-white/40">
              {link.exercise.muscleGroup} · {link.exercise.equipment} · {link.targetSets}x{link.targetReps} · {link.restSeconds}s descanso
            </p>
          </div>
          {#if !activeSession}
            <button class="text-white/40 text-sm shrink-0" on:click={() => removeExerciseLink(link.id)}>remover</button>
          {/if}
        </div>
      {/each}
    </div>

    {#if todaysFinishedSession}
      <div class="bg-xp/10 border border-xp/30 rounded-xl p-4 text-center text-sm text-xp mb-3">
        ✅ Treino já concluído hoje
      </div>
      <button
        class="w-full bg-surface text-sm text-primary rounded-xl py-3"
        on:click={() => navigate('training-metrics', { focusPlanId: planId })}
      >
        Ver evolução deste treino →
      </button>
    {:else if activeSession}
      <div class="mb-4">
        <h2 class="text-sm uppercase font-bold text-white/40 mb-4 text-center tracking-wider">Sessão em andamento</h2>
        <div class="flex flex-col gap-5">
          {#each exercises as link (link.id)}
            <div class="bg-surface rounded-2xl p-4 shadow-sm border border-white/5">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-base font-semibold {completedExercises[link.id] ? 'text-primary' : ''}">{link.exercise.name}</h3>
                <span class="text-[10px] uppercase font-bold text-white/40 tracking-wider bg-bg px-2 py-1 rounded-lg border border-white/5">
                  Alvo: {link.targetSets}x{link.targetReps}
                </span>
              </div>
              
              {#if !completedExercises[link.id]}
                <!-- Tabela de Séries -->
                <div class="flex flex-col gap-2">
                  <!-- Cabeçalho -->
                  <div class="flex items-center text-[10px] uppercase font-bold text-white/40 mb-1 px-1">
                    <div class="w-10 text-center">Série</div>
                    <div class="flex-1 text-center">Carga (kg)</div>
                    <div class="flex-1 text-center">Reps</div>
                    <div class="w-11 text-center"></div>
                  </div>

                  {#each Array(link.targetSets) as _, i}
                    {@const setNumber = i + 1}
                    {@const saved = savedSet(link.id, setNumber)}
                    {@const key = `${link.id}-${setNumber}`}
                    <div class="flex items-center gap-1.5 p-1.5 rounded-xl transition-all {saved ? 'bg-primary/10 border border-primary/20' : 'bg-bg/50 border border-white/5'}">
                      <!-- Set Number -->
                      <div class="w-10 text-center font-bold text-sm {saved ? 'text-primary' : 'text-white/60'}">
                        {setNumber}
                      </div>
                      
                      <!-- Weight Input -->
                      <div class="flex-1 relative">
                        <input
                          type="number"
                          class="w-full bg-surface border border-white/5 rounded-lg px-1 py-2.5 text-center font-semibold focus:border-primary outline-none transition-colors {saved ? 'text-primary/90' : 'text-white'}"
                          placeholder="-"
                          value={setInputs[key]?.weight ?? (saved?.weightKg ?? '')}
                          on:input={(e) => (setInputs[key] = { ...setInputs[key], weight: e.target.value })}
                        />
                      </div>

                      <!-- Reps Input -->
                      <div class="flex-1 relative">
                        <input
                          type="number"
                          class="w-full bg-surface border border-white/5 rounded-lg px-1 py-2.5 text-center font-semibold focus:border-primary outline-none transition-colors {saved ? 'text-primary/90' : 'text-white'}"
                          placeholder={link.targetReps}
                          value={setInputs[key]?.reps ?? (saved?.repsDone ?? '')}
                          on:input={(e) => (setInputs[key] = { ...setInputs[key], reps: e.target.value })}
                        />
                      </div>

                      <!-- Check Button -->
                      <button
                        class="shrink-0 w-11 h-10 rounded-lg flex items-center justify-center text-lg transition-all {saved ? 'bg-primary text-white shadow-[0_0_15px_rgba(124,92,255,0.4)]' : 'bg-surface border border-white/10 text-white/40 hover:text-white hover:border-primary hover:bg-white/5'}"
                        on:click={() => handleSaveSet(link, setNumber)}
                        aria-label="Salvar série {setNumber} de {link.exercise.name}"
                      >
                        {saved ? '✓' : '＋'}
                      </button>
                    </div>
                  {/each}
                </div>

                <div class="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                  <button class="w-full bg-surface border border-white/10 text-white/70 rounded-xl py-3 text-sm font-semibold hover:bg-white/5 transition-colors" on:click={() => completedExercises[link.id] = true}>
                    Concluir Exercício
                  </button>
                  <button class="w-full text-xs text-xp/70 underline py-2" on:click={handleFinishWorkout}>
                    ✅ Encerrar sessão completa
                  </button>
                </div>
              {:else}
                <div class="flex flex-col gap-2">
                  {#if activeRestLinkId === link.id}
                    <div class="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-3">
                      <div class="flex items-center gap-3">
                        <span class="text-2xl">⏳</span>
                        <div>
                          <p class="text-[10px] text-white/50 uppercase font-bold tracking-wider">Descanso</p>
                          <p class="text-2xl font-mono font-bold text-primary leading-none">
                            {Math.floor(restTimeLeft / 60).toString().padStart(2, '0')}:{(restTimeLeft % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                      <button class="bg-surface border border-white/10 text-white/50 px-4 py-2 rounded-lg text-sm font-semibold hover:text-white" on:click={stopRest}>
                        Pular
                      </button>
                    </div>
                  {:else}
                    <button class="w-full bg-primary/20 border border-primary/30 text-primary rounded-xl py-3 text-sm font-semibold hover:bg-primary/30 transition-colors" on:click={() => startRest(link.id, link.restSeconds)}>
                      ⏳ Iniciar Descanso ({link.restSeconds}s)
                    </button>
                  {/if}
                  
                  <div class="flex justify-between items-center mt-2">
                    <button class="text-xs text-white/40 underline text-center px-2 py-1" on:click={() => completedExercises[link.id] = false}>
                      Reabrir exercício
                    </button>
                    <button class="text-xs text-xp/70 underline text-center px-2 py-1" on:click={handleFinishWorkout}>
                      Encerrar sessão completa
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>


    {:else}
      <button
        class="w-full bg-primary text-white rounded-xl py-4 font-semibold disabled:opacity-50"
        disabled={starting}
        on:click={handleStartWorkout}
      >
        {starting ? 'Iniciando...' : '▶ Iniciar treino'}
      </button>
    {/if}
  {/if}
</main>
