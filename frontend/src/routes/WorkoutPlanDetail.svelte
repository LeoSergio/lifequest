<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../lib/constants.js';
  import { applyXp } from '../lib/gamification.js';

  export let planId; // recebido via navigate('workout-plan-detail', { planId })

  let exerciseName = '';
  let muscleGroup = MUSCLE_GROUPS[0];
  let equipment = EQUIPMENT_TYPES[0];
  let targetSets = 3;
  let targetReps = '8-12';
  let restSeconds = 90;
  let completing = false;

  const plan = liveQuery(() => db.workoutPlans.get(planId));
  const exercises = liveQuery(() =>
    db.workoutPlanExercises.where('workoutPlanId').equals(planId).sortBy('order')
  );

  const today = new Date().toISOString().slice(0, 10);
  // Verifica se esse treino específico já foi concluído hoje, pra não
  // deixar o usuário clicar várias vezes e "farmar" XP no mesmo dia.
  const todaysSession = liveQuery(() =>
    db.workoutSessions
      .where('workoutPlanId')
      .equals(planId)
      .filter((s) => s.finishedAt?.slice(0, 10) === today)
      .first()
  );

  async function addExercise() {
    if (!exerciseName.trim()) return;

    const count = await db.workoutPlanExercises.where('workoutPlanId').equals(planId).count();

    await db.workoutPlanExercises.add({
      workoutPlanId: planId,
      exerciseName: exerciseName.trim(),
      muscleGroup,
      equipment,
      order: count,
      targetSets: Number(targetSets),
      targetReps,
      restSeconds: Number(restSeconds)
    });

    exerciseName = '';
    targetSets = 3;
    targetReps = '8-12';
    restSeconds = 90;
  }

  async function removeExercise(id) {
    await db.workoutPlanExercises.delete(id);
  }

  async function completeWorkout() {
    completing = true;
    try {
      const now = new Date().toISOString();

      await db.workoutSessions.add({
        workoutPlanId: planId,
        startedAt: now,
        finishedAt: now
      });

      // XP proporcional ao tamanho do treino, com um piso — treinos
      // maiores rendem mais, mas nenhum treino concluído vale "pouco".
      const exerciseCount = $exercises?.length ?? 0;
      const xpReward = Math.max(30, exerciseCount * 15);

      const currentPlayer = await db.player.toCollection().first();
      const { level, xp, leveledUp } = applyXp(currentPlayer.level, currentPlayer.xp, xpReward);
      await db.player.update(currentPlayer.id, { level, xp });

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

  {#if $plan}
    <h1 class="text-2xl font-bold text-primary mb-6">{$plan.name}</h1>
  {/if}

  <form on:submit|preventDefault={addExercise} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
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
        <label class="text-xs text-white/40">Séries</label>
        <input type="number" class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={targetSets} />
      </div>
      <div class="flex-1">
        <label class="text-xs text-white/40">Reps</label>
        <input class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={targetReps} />
      </div>
      <div class="flex-1">
        <label class="text-xs text-white/40">Descanso (s)</label>
        <input type="number" class="w-full bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm" bind:value={restSeconds} />
      </div>
    </div>

    <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">Adicionar exercício</button>
  </form>

  {#if $exercises === undefined}
    <p class="text-sm text-white/40">Carregando...</p>
  {:else if $exercises.length === 0}
    <p class="text-sm text-white/40">Nenhum exercício ainda. Adicione o primeiro acima.</p>
  {:else}
    <div class="flex flex-col gap-2 mb-6">
      {#each $exercises as ex (ex.id)}
        <div class="bg-surface rounded-lg p-3 flex justify-between items-center">
          <div>
            <h3 class="text-sm font-semibold">{ex.exerciseName}</h3>
            <p class="text-xs text-white/40">
              {ex.muscleGroup} · {ex.equipment} · {ex.targetSets}x{ex.targetReps} · {ex.restSeconds}s descanso
            </p>
          </div>
          <button class="text-white/40 text-sm shrink-0" on:click={() => removeExercise(ex.id)}>remover</button>
        </div>
      {/each}
    </div>

    {#if $todaysSession}
      <div class="bg-xp/10 border border-xp/30 rounded-xl p-4 text-center text-sm text-xp">
        ✅ Treino já concluído hoje
      </div>
    {:else}
      <button
        class="w-full bg-xp text-bg rounded-xl py-4 font-semibold disabled:opacity-50"
        disabled={completing}
        on:click={completeWorkout}
      >
        {completing ? 'Registrando...' : '✅ Concluir treino'}
      </button>
    {/if}
  {/if}
</main>
