#!/usr/bin/env bash
set -e
# Rode a partir da raiz do repo lifequest (onde fica a pasta frontend/).

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/WorkoutPlanDetail.svelte" << 'LIFEQUEST_EOF'
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
  let starting = false;

  // Inputs de peso/reps ainda não salvos, por "linkId-numeroDaSerie".
  // Só existe em memória até o usuário tocar em "salvar" naquela série.
  let setInputs = {};

  const plan = liveQuery(() => db.workoutPlans.get(planId));

  // workoutPlanExercises guarda só o "vínculo" (quantas séries, reps,
  // descanso, ordem) — o nome/grupo muscular/equipamento vivem no
  // catálogo `exercises`, que é compartilhado entre todos os planos.
  // Isso é o que faz o histórico de carga sobreviver mesmo se esse
  // plano for apagado depois (ver comentário na migração v5 em db.js).
  const links = liveQuery(() =>
    db.workoutPlanExercises.where('workoutPlanId').equals(planId).sortBy('order')
  );
  const catalog = liveQuery(() => db.exercises.toArray());

  $: exercises = ($links ?? []).map((link) => ({
    ...link,
    exercise: ($catalog ?? []).find((e) => e.id === link.exerciseId) ?? { name: '(exercício removido)' }
  }));

  const planSessions = liveQuery(() => db.workoutSessions.where('workoutPlanId').equals(planId).toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  const today = new Date().toISOString().slice(0, 10);

  // Sessão em andamento (iniciada, ainda sem finishedAt) — é aqui que a
  // tela de registro de séries aparece. Sessão finalizada hoje é outro
  // estado, só pra travar um segundo treino no mesmo dia.
  $: activeSession = ($planSessions ?? []).find((s) => !s.finishedAt) ?? null;
  $: todaysFinishedSession = ($planSessions ?? []).find((s) => s.finishedAt?.slice(0, 10) === today);

  $: activeSets = activeSession && $allSessionSets
    ? $allSessionSets.filter((s) => s.workoutSessionId === activeSession.id)
    : [];

  function savedSet(linkId, setNumber) {
    return activeSets.find((s) => s.workoutPlanExerciseId === linkId && s.setNumber === setNumber);
  }

  // Acha um exercício já existente no catálogo pelo nome (sem diferenciar
  // maiúsculas/minúsculas, pra "Supino Reto" e "supino reto" não virarem
  // duas linhas de histórico separadas) ou cria um novo. Se já existir,
  // atualiza o grupo muscular/equipamento pro que foi escolhido agora —
  // o catálogo reflete sempre a classificação mais recente.
  async function findOrCreateExercise(name, mg, eq) {
    const trimmed = name.trim();
    const existing = ($catalog ?? []).find((e) => e.name.toLowerCase() === trimmed.toLowerCase());

    if (existing) {
      await db.exercises.update(existing.id, { muscleGroup: mg, equipment: eq });
      return existing.id;
    }

    return db.exercises.add({ name: trimmed, muscleGroup: mg, equipment: eq });
  }

  async function addExercise() {
    if (!exerciseName.trim()) return;

    const exerciseId = await findOrCreateExercise(exerciseName, muscleGroup, equipment);
    const count = await db.workoutPlanExercises.where('workoutPlanId').equals(planId).count();

    await db.workoutPlanExercises.add({
      workoutPlanId: planId,
      exerciseId,
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

  async function removeExercise(linkId) {
    // Remove só o vínculo desse plano com o exercício — o exercício em
    // si continua no catálogo, então o histórico de carga dele em
    // Métricas não é afetado.
    await db.workoutPlanExercises.delete(linkId);
  }

  async function startWorkout() {
    starting = true;
    try {
      await db.workoutSessions.add({
        workoutPlanId: planId,
        startedAt: new Date().toISOString(),
        finishedAt: null
      });
    } finally {
      starting = false;
    }
  }

  // Grava (ou atualiza, se o usuário corrigir um valor) uma série
  // específica — é isso que alimenta o gráfico de Desempenho em
  // TrainingMetrics.svelte. Guardamos exerciseId direto aqui (além do
  // workoutPlanExerciseId) pra esse histórico não depender do vínculo
  // com o plano continuar existindo.
  async function saveSet(link, setNumber) {
    const key = `${link.id}-${setNumber}`;
    const input = setInputs[key] ?? {};
    const weightKg = input.weight === '' || input.weight == null ? null : Number(input.weight);
    const repsDone = input.reps === '' || input.reps == null ? null : Number(input.reps);

    const existing = savedSet(link.id, setNumber);

    // Evita criar um registro vazio se o campo só perdeu o foco (blur)
    // sem nada ter sido digitado — só grava se já existe algo salvo pra
    // atualizar, ou se pelo menos um valor novo foi preenchido.
    if (!existing && weightKg == null && repsDone == null) return;

    if (existing) {
      await db.sessionSets.update(existing.id, { weightKg, repsDone, completedAt: new Date().toISOString() });
    } else {
      await db.sessionSets.add({
        workoutSessionId: activeSession.id,
        workoutPlanExerciseId: link.id,
        exerciseId: link.exerciseId,
        setNumber,
        weightKg,
        repsDone,
        completedAt: new Date().toISOString()
      });
    }
  }

  async function finishWorkout() {
    if (!activeSession) return;
    completing = true;
    try {
      // Rede de segurança: qualquer série que o usuário preencheu mas
      // esqueceu de tocar em 💾 é salva agora — antes disso, digitar o
      // peso sem apertar salvar em cada linha fazia o dado se perder
      // silenciosamente, e o gráfico de Desempenho ficava vazio mesmo
      // depois de um treino "concluído".
      for (const link of exercises) {
        for (let setNumber = 1; setNumber <= link.targetSets; setNumber++) {
          const key = `${link.id}-${setNumber}`;
          const input = setInputs[key];
          const alreadySaved = savedSet(link.id, setNumber);
          if (input && !alreadySaved && (input.weight !== '' || input.reps !== '')) {
            await saveSet(link, setNumber);
          }
        }
      }

      await db.workoutSessions.update(activeSession.id, { finishedAt: new Date().toISOString() });

      // XP proporcional ao tamanho do treino, com um piso — treinos
      // maiores rendem mais, mas nenhum treino concluído vale "pouco".
      const exerciseCount = exercises.length;
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
            <button class="text-white/40 text-sm shrink-0" on:click={() => removeExercise(link.id)}>remover</button>
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
                      on:blur={() => saveSet(link, setNumber)}
                    />
                    <input
                      type="number"
                      class="flex-1 bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm"
                      placeholder="reps"
                      value={saved ? saved.repsDone : (setInputs[key]?.reps ?? '')}
                      on:input={(e) => (setInputs[key] = { ...setInputs[key], reps: e.target.value })}
                      on:blur={() => saveSet(link, setNumber)}
                    />
                    <button
                      class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm {saved ? 'bg-xp text-bg' : 'bg-primary text-white'}"
                      on:click={() => saveSet(link, setNumber)}
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
        on:click={finishWorkout}
      >
        {completing ? 'Registrando...' : '✅ Finalizar treino'}
      </button>
    {:else}
      <button
        class="w-full bg-primary text-white rounded-xl py-4 font-semibold disabled:opacity-50"
        disabled={starting}
        on:click={startWorkout}
      >
        {starting ? 'Iniciando...' : '▶ Iniciar treino'}
      </button>
    {/if}
  {/if}
</main>
LIFEQUEST_EOF
echo "Pronto. Rode: cd frontend && npm install && npm run dev"
