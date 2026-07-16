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
    await persistSet({ activeSession, activeSets, link, setNumber, input: setInputs[key] });
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
        <h2 class="text-sm uppercase text-white/40 mb-3">Sessão de hoje — registre suas séries</h2>
        <div class="flex flex-col gap-4">
          {#each exercises as link (link.id)}
            <div class="bg-surface rounded-xl p-4">
              <h3 class="text-sm font-semibold mb-3">{link.exercise.name}</h3>
              <div class="flex flex-col gap-2">
                {#each Array(link.targetSets) as _, i}
                  {@const setNumber = i + 1}
                  {@const saved = savedSet(link.id, setNumber)}
                  {@const key = `${link.id}-${setNumber}`}
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-white/40 w-14 shrink-0">Série {setNumber}</span>
                    <input
                      type="number"
                      class="flex-1 bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm"
                      placeholder="kg"
                      value={saved ? saved.weightKg : (setInputs[key]?.weight ?? '')}
                      on:input={(e) => (setInputs[key] = { ...setInputs[key], weight: e.target.value })}
                      on:blur={() => handleSaveSet(link, setNumber)}
                    />
                    <input
                      type="number"
                      class="flex-1 bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm"
                      placeholder="reps"
                      value={saved ? saved.repsDone : (setInputs[key]?.reps ?? '')}
                      on:input={(e) => (setInputs[key] = { ...setInputs[key], reps: e.target.value })}
                      on:blur={() => handleSaveSet(link, setNumber)}
                    />
                    <button
                      class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm {saved ? 'bg-xp text-bg' : 'bg-primary text-white'}"
                      on:click={() => handleSaveSet(link, setNumber)}
                      aria-label="Salvar série {setNumber} de {link.exercise.name}"
                    >
                      {saved ? '✓' : '💾'}
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <button
        class="w-full bg-xp text-bg rounded-xl py-4 font-semibold disabled:opacity-50"
        disabled={completing}
        on:click={handleFinishWorkout}
      >
        {completing ? 'Registrando...' : '✅ Finalizar treino'}
      </button>
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
