#!/usr/bin/env bash
set -e
# Rode a partir da raiz do repo lifequest (onde fica a pasta frontend/).
# Pré-requisito: já ter aplicado os scripts anteriores (habitos/scan/onboarding, metas, calendario).

mkdir -p "frontend/src/db"
cat > "frontend/src/db/db.js" << 'LIFEQUEST_EOF'
import Dexie from 'dexie';

// Local-first: este é o único "banco de dados" do usuário.
// Nada aqui sobe para o backend, exceto payloads efêmeros enviados
// pontualmente para as rotas de IA (backend é stateless).
export const db = new Dexie('lifequest');

db.version(1).stores({
  // Pilar 1 — Onboarding & Dashboard
  player: '++id, archetype, level, xp, streak, createdAt',
  missions: '++id, pillar, status, dueDate, difficulty',

  // Pilar 2 — Gestão do Lar & Inteligência Financeira
  pantryItems: '++id, name, category, quantity, updatedAt',
  shoppingList: '++id, itemName, checked, recipeId, createdAt',
  budget: '++id, month, limit, spent',

  // Pilar 3 — Academia & Nutrição Sincronizada
  workoutPlans: '++id, name, weekday, estimatedDuration',
  workoutPlanExercises: '++id, workoutPlanId, exerciseId, order, targetSets, targetReps, restSeconds',
  exercises: '++id, name, muscleGroup, equipment',
  workoutSessions: '++id, workoutPlanId, startedAt, finishedAt',
  sessionSets: '++id, workoutSessionId, workoutPlanExerciseId, setNumber, weightKg, repsDone, completedAt',
  recipes: '++id, title, goalContext, createdAt',

  // Pilar 4 — Disciplina & Social (apenas o vínculo local com a guilda)
  guildMembership: '++id, guildId, joinedAt'
});

// Migração aditiva: só precisamos declarar a tabela NOVA aqui — o Dexie
// mantém automaticamente todas as tabelas já definidas na version(1).
// Isso é importante: quem já tinha o app instalado no navegador vai
// receber essa tabela nova sem perder nenhum dado existente.
db.version(2).stores({
  bodyMeasurements: '++id, date'
});

// Hábitos absorvem o que antes era "missões": em vez de a IA gerar missões
// pontuais no onboarding, o usuário cria e mantém seus próprios hábitos,
// com histórico de conclusões (habitCompletions) — igual ao streak de
// treino em metrics.js, nunca guardamos "streak" como campo solto.
db.version(3).stores({
  habits: '++id, title, icon, cadence, weeklyTarget, xpReward, archivedAt, createdAt',
  habitCompletions: '++id, habitId, date'
});

// Metas: diferente de hábito (repetição contínua), uma meta tem um alvo
// numérico único e um fim — ao bater `targetValue`, ela é marcada como
// alcançada (achievedAt) e não volta atrás. Progresso é atualizado
// manualmente pelo usuário (local-first: sem depender de nenhuma fonte
// externa por padrão).
db.version(4).stores({
  goals: '++id, title, targetValue, currentValue, unit, reward, xpReward, deadline, achievedAt, createdAt'
});

// Conserta uma lacuna que existia desde a v1: o índice `exerciseId` já
// estava declarado em workoutPlanExercises, mas o app nunca escrevia
// nele — exercícios eram identificados só por um `exerciseName` solto
// copiado em cada plano, e a tabela `exercises` (catálogo) ficava sem
// uso. Consequência prática: apagar um treino apagava o acesso ao
// histórico de carga daquele exercício em Métricas, mesmo os dados
// (sessionSets) continuando salvos.
//
// Agora exerciseId vira a identidade estável: workoutPlanExercises
// aponta pra um exercicio do catálogo, e sessionSets guarda o
// exerciseId direto (não só o workoutPlanExerciseId), então o
// histórico de desempenho sobrevive mesmo se o plano for apagado depois.
db.version(5)
  .stores({
    sessionSets: '++id, workoutSessionId, workoutPlanExerciseId, exerciseId, setNumber, weightKg, repsDone, completedAt'
  })
  .upgrade(async (tx) => {
    const wpeTable = tx.table('workoutPlanExercises');
    const exTable = tx.table('exercises');
    const setsTable = tx.table('sessionSets');

    const oldRows = await wpeTable.toArray();
    const nameToId = new Map();
    const wpeIdToExerciseId = new Map();

    for (const row of oldRows) {
      if (row.exerciseId != null) {
        wpeIdToExerciseId.set(row.id, row.exerciseId);
        continue;
      }

      const key = (row.exerciseName ?? '').trim().toLowerCase();
      if (!key) continue;

      let exerciseId = nameToId.get(key);
      if (exerciseId == null) {
        exerciseId = await exTable.add({
          name: row.exerciseName.trim(),
          muscleGroup: row.muscleGroup ?? null,
          equipment: row.equipment ?? null
        });
        nameToId.set(key, exerciseId);
      }

      wpeIdToExerciseId.set(row.id, exerciseId);
      await wpeTable.update(row.id, { exerciseId });
    }

    const oldSets = await setsTable.toArray();
    for (const set of oldSets) {
      const exerciseId = wpeIdToExerciseId.get(set.workoutPlanExerciseId);
      if (exerciseId != null) {
        await setsTable.update(set.id, { exerciseId });
      }
    }
  });

export default db;
LIFEQUEST_EOF

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
        on:click={() => navigate('training-metrics', { focusExerciseId: exercises[0]?.exerciseId })}
      >
        Ver evolução de carga →
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
                    />
                    <input
                      type="number"
                      class="flex-1 bg-bg border border-white/10 rounded-lg px-2 py-2 text-sm"
                      placeholder="reps"
                      value={saved ? saved.repsDone : (setInputs[key]?.reps ?? '')}
                      on:input={(e) => (setInputs[key] = { ...setInputs[key], reps: e.target.value })}
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

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/TrainingMetrics.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import BarChart from '../components/BarChart.svelte';
  import RadarChart from '../components/RadarChart.svelte';
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import { maxWeightByDay, weeklyCalendar, currentStreak } from '../lib/metrics.js';

  // Vindo de um link contextual em WorkoutPlanDetail (ex: "ver evolução
  // de carga" depois de terminar um treino) — se presente, a aba de
  // Desempenho já abre com esse exercício selecionado.
  export let focusExerciseId = null;

  let tab = focusExerciseId ? 'desempenho' : 'perimetricas'; // perimetricas | desempenho | consistencia

  // ---------- Perimétricas ----------
  let date = new Date().toISOString().slice(0, 10);

  let age = '';
  let weight = '';
  let height = '';

  let shoulder = '';
  let chest = '';
  let abdomen = '';
  let thigh = '';
  let calf = '';
  let armLeft = '';
  let armRight = '';
  let forearm = '';

  const measurements = liveQuery(() => db.bodyMeasurements.orderBy('date').toArray());

  $: latestMeasurement = $measurements && $measurements.length > 0 ? $measurements[$measurements.length - 1] : null;

  $: radarData = latestMeasurement
    ? {
        labels: ['Ombro', 'Tórax', 'Abdômen', 'Coxa', 'Panturrilha', 'Braço E', 'Braço D', 'Antebraço'],
        data: [
          latestMeasurement.shoulder ?? 0,
          latestMeasurement.chest ?? 0,
          latestMeasurement.abdomen ?? 0,
          latestMeasurement.thigh ?? 0,
          latestMeasurement.calf ?? 0,
          latestMeasurement.armLeft ?? 0,
          latestMeasurement.armRight ?? 0,
          latestMeasurement.forearm ?? 0
        ]
      }
    : null;

  // Peso ao longo do tempo — já tínhamos o histórico completo em
  // bodyMeasurements, só não existia nenhum gráfico usando ele (só o
  // "retrato" mais recente aparecia, no radar).
  $: weightTrend = $measurements
    ? {
        labels: $measurements.filter((m) => m.weight != null).map((m) => m.date.slice(5).split('-').reverse().join('/')),
        data: $measurements.filter((m) => m.weight != null).map((m) => m.weight)
      }
    : { labels: [], data: [] };

  function toNumberOrNull(value) {
    return value === '' ? null : Number(value);
  }

  async function addMeasurement() {
    await db.bodyMeasurements.add({
      date,
      age: toNumberOrNull(age),
      weight: toNumberOrNull(weight),
      height: toNumberOrNull(height),
      shoulder: toNumberOrNull(shoulder),
      chest: toNumberOrNull(chest),
      abdomen: toNumberOrNull(abdomen),
      thigh: toNumberOrNull(thigh),
      calf: toNumberOrNull(calf),
      armLeft: toNumberOrNull(armLeft),
      armRight: toNumberOrNull(armRight),
      forearm: toNumberOrNull(forearm)
    });

    age = weight = height = shoulder = chest = abdomen = thigh = calf = armLeft = armRight = forearm = '';
  }

  // ---------- Desempenho (carga por exercício) ----------
  // Antes isso vinha de workoutPlanExercises, o que fazia o histórico
  // sumir do dropdown se o plano fosse apagado. Agora vem do catálogo
  // `exercises`, que é estável — e sessionSets guarda exerciseId direto
  // (ver migração v5 em db.js), então o dado não depende do plano.
  const catalog = liveQuery(() => db.exercises.toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  let selectedExercise = focusExerciseId ?? null;

  // Exercícios com histórico de sessão aparecem primeiro — assim a
  // pessoa não precisa abrir 4 exercícios vazios até achar um com dado.
  $: exerciseOptions = ($catalog ?? [])
    .map((e) => ({
      ...e,
      hasData: ($allSessionSets ?? []).some((s) => s.exerciseId === e.id)
    }))
    .sort((a, b) => Number(b.hasData) - Number(a.hasData) || a.name.localeCompare(b.name));

  $: if (selectedExercise == null && exerciseOptions.length > 0) selectedExercise = exerciseOptions[0].id;

  $: performanceData =
    selectedExercise != null && $allSessionSets
      ? maxWeightByDay($allSessionSets.filter((s) => s.exerciseId === selectedExercise))
      : { labels: [], data: [] };

  $: selectedExerciseName = exerciseOptions.find((e) => e.id === selectedExercise)?.name ?? '';

  // ---------- Consistência ----------
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  $: calendarColumns = $sessions ? weeklyCalendar($sessions, 9) : [];
  $: totalTrained = $sessions ? new Set($sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10))).size : 0;
  $: streak = $sessions ? currentStreak($sessions) : 0;
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <button class="text-sm text-white/40 mb-4" on:click={() => navigate('training')}>← Treinos</button>
  <h1 class="text-2xl font-bold text-primary mb-4">Métricas</h1>

  <div class="flex bg-surface rounded-xl p-1 mb-6 text-xs">
    {#each [['perimetricas', 'Perimétricas'], ['desempenho', 'Desempenho'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'perimetricas'}
    <section>
      {#if latestMeasurement}
        <div class="bg-surface rounded-xl p-4 mb-3 flex justify-around text-center">
          <div>
            <p class="text-xs text-white/40">Idade</p>
            <p class="font-semibold">{latestMeasurement.age ?? '-'}</p>
          </div>
          <div>
            <p class="text-xs text-white/40">Peso</p>
            <p class="font-semibold">{latestMeasurement.weight ? `${latestMeasurement.weight}kg` : '-'}</p>
          </div>
          <div>
            <p class="text-xs text-white/40">Altura</p>
            <p class="font-semibold">{latestMeasurement.height ? `${latestMeasurement.height}cm` : '-'}</p>
          </div>
        </div>
      {/if}

      {#if weightTrend.labels.length >= 2}
        <div class="bg-surface rounded-xl p-4 mb-3">
          <p class="text-xs text-white/40 mb-2">Peso ao longo do tempo</p>
          <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
        </div>
      {/if}

      {#if radarData}
        <div class="bg-surface rounded-xl p-4 mb-4">
          <RadarChart labels={radarData.labels} data={radarData.data} label="cm (última medição)" />
        </div>
      {:else}
        <p class="text-sm text-white/40 mb-4">Registre sua primeira medição abaixo para ver o gráfico.</p>
      {/if}

      <form on:submit|preventDefault={addMeasurement} class="bg-surface rounded-xl p-4 flex flex-col gap-3">
        <input type="date" class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" bind:value={date} />

        <div>
          <p class="text-xs text-white/40 mb-1">Perfil</p>
          <div class="grid grid-cols-3 gap-2">
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Idade" type="number" bind:value={age} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Peso (kg)" type="number" bind:value={weight} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Altura (cm)" type="number" bind:value={height} />
          </div>
        </div>

        <div>
          <p class="text-xs text-white/40 mb-1">Circunferências (cm)</p>
          <div class="grid grid-cols-2 gap-2">
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Ombro" type="number" bind:value={shoulder} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Tórax" type="number" bind:value={chest} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Abdômen" type="number" bind:value={abdomen} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Coxa" type="number" bind:value={thigh} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Panturrilha" type="number" bind:value={calf} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Antebraço" type="number" bind:value={forearm} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço esquerdo" type="number" bind:value={armLeft} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço direito" type="number" bind:value={armRight} />
          </div>
        </div>

        <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium text-sm">Registrar medição</button>
      </form>
    </section>
  {:else if tab === 'desempenho'}
    <section>
      {#if exerciseOptions.length === 0}
        <p class="text-sm text-white/40">Cadastre exercícios em um treino para ver a evolução de carga aqui.</p>
      {:else}
        <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-3" bind:value={selectedExercise}>
          {#each exerciseOptions as ex}
            <option value={ex.id}>{ex.name}{ex.hasData ? '' : ' (sem dados ainda)'}</option>
          {/each}
        </select>

        <div class="bg-surface rounded-xl p-4">
          {#if performanceData.labels.length === 0}
            <p class="text-sm text-white/40">
              Ainda sem sessões registradas para "{selectedExerciseName}". Esse gráfico se preenche quando você
              começar a executar os treinos e registrar peso/reps.
            </p>
          {:else}
            <BarChart labels={performanceData.labels} data={performanceData.data} label="{selectedExerciseName} (kg)" />
          {/if}
        </div>
      {/if}
    </section>
  {:else}
    <section>
      <div class="bg-surface rounded-xl p-4">
        {#if $sessions && $sessions.length === 0}
          <p class="text-sm text-white/40">
            Nenhuma sessão de treino concluída ainda — esse calendário marca em quais dias você treinou.
          </p>
        {:else}
          <ConsistencyCalendar columns={calendarColumns} {totalTrained} {streak} />
        {/if}
      </div>
    </section>
  {/if}
</main>
LIFEQUEST_EOF

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/Training.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS } from '../lib/constants.js';

  const plans = liveQuery(() => db.workoutPlans.toArray());

  let openMenuId = null;

  function weekdayLabel(value) {
    return WEEKDAYS.find((w) => w.value === value)?.label ?? 'Livre';
  }

  function toggleMenu(id) {
    openMenuId = openMenuId === id ? null : id;
  }

  async function removePlan(id) {
    openMenuId = null;
    if (!confirm('Remover este treino e todos os exercícios dele?')) return;

    // Remove o plano e os exercícios ligados a ele (limpeza em cascata manual,
    // já que o Dexie não faz isso sozinho como um banco relacional faria).
    await db.transaction('rw', db.workoutPlans, db.workoutPlanExercises, async () => {
      await db.workoutPlans.delete(id);
      await db.workoutPlanExercises.where('workoutPlanId').equals(id).delete();
    });
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <div class="flex justify-between items-center mb-2">
    <h1 class="text-2xl font-bold text-primary">Treinos</h1>
    <button
      class="bg-primary text-white rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1"
      on:click={() => navigate('training-new')}
    >
      <span class="text-base leading-none">+</span> Novo treino
    </button>
  </div>

  {#if $plans === undefined}
    <p class="text-sm text-white/40">Carregando...</p>
  {:else if $plans.length === 0}
    <div class="bg-surface rounded-xl p-6 text-center">
      <p class="text-sm text-white/40 mb-1">Nenhum treino cadastrado ainda.</p>
      <p class="text-xs text-white/30">Toque em "+ Novo treino" para criar o primeiro.</p>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each $plans as plan (plan.id)}
        <div class="bg-surface rounded-xl p-3 flex items-center gap-3 relative">
          <button
            class="flex items-center gap-3 flex-1 min-w-0 text-left"
            on:click={() => navigate('workout-plan-detail', { planId: plan.id })}
          >
            <div
              class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-lg"
              style="background: linear-gradient(135deg, #7c5cff, #4c2fc9);"
            >
              🏋️
            </div>
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{plan.name}</h3>
              <p class="text-xs text-white/40">
                {weekdayLabel(plan.weekday)}
                {#if plan.estimatedDuration}· ~{plan.estimatedDuration} min{/if}
              </p>
            </div>
          </button>

          <button
            class="text-white/40 px-2 py-1 text-lg shrink-0"
            on:click|stopPropagation={() => toggleMenu(plan.id)}
          >
            ⋮
          </button>

          {#if openMenuId === plan.id}
            <div class="absolute right-3 top-14 bg-bg border border-white/10 rounded-lg shadow-lg py-1 z-10 w-32">
              <button
                class="w-full text-left px-3 py-2 text-sm text-danger hover:bg-white/5"
                on:click|stopPropagation={() => removePlan(plan.id)}
              >
                Remover
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</main>
LIFEQUEST_EOF

mkdir -p "frontend/src/components"
cat > "frontend/src/components/NavBar.svelte" << 'LIFEQUEST_EOF'
<script>
  import { nav, navigate } from '../lib/nav.js';

  // "Escanear" saiu da barra: o scan de nota fiscal agora vive dentro da
  // própria tela de Despensa (ver routes/Pantry.svelte), então não faz
  // sentido ocupar uma aba própria só pra isso.
  const tabs = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'pantry', label: 'Despensa', icon: '🥫' },
    { id: 'habits', label: 'Hábitos', icon: '✅' },
    { id: 'goals', label: 'Metas', icon: '🏆' },
    { id: 'training', label: 'Treino', icon: '💪' },
    { id: 'training-metrics', label: 'Métricas', icon: '📊' }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 flex">
  {#each tabs as tab}
    <button
      class="flex-1 flex flex-col items-center gap-1 py-3 text-xs {$nav.name === tab.id ? 'text-primary' : 'text-white/40'}"
      on:click={() => navigate(tab.id)}
    >
      <span class="text-xl">{tab.icon}</span>
      {tab.label}
    </button>
  {/each}
</nav>
LIFEQUEST_EOF

mkdir -p "frontend/src/."
cat > "frontend/src/App.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import { db } from './db/db.js';
  import { nav } from './lib/nav.js';
  import Onboarding from './routes/Onboarding.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Pantry from './routes/Pantry.svelte';
  import Habits from './routes/Habits.svelte';
  import Goals from './routes/Goals.svelte';
  import Training from './routes/Training.svelte';
  import NewWorkoutPlan from './routes/NewWorkoutPlan.svelte';
  import TrainingMetrics from './routes/TrainingMetrics.svelte';
  import WorkoutPlanDetail from './routes/WorkoutPlanDetail.svelte';
  import NavBar from './components/NavBar.svelte';

  const hasPlayer = liveQuery(async () => (await db.player.count()) > 0);
</script>

{#if $hasPlayer === undefined}
  <main class="min-h-screen flex items-center justify-center">
    <p class="text-white/40 text-sm">Carregando...</p>
  </main>
{:else if $hasPlayer}
  {#if $nav.name === 'pantry'}
    <Pantry />
  {:else if $nav.name === 'habits'}
    <Habits />
  {:else if $nav.name === 'goals'}
    <Goals />
  {:else if $nav.name === 'training'}
    <Training />
  {:else if $nav.name === 'training-new'}
    <NewWorkoutPlan />
  {:else if $nav.name === 'training-metrics'}
    <TrainingMetrics focusExerciseId={$nav.params.focusExerciseId} />
  {:else if $nav.name === 'workout-plan-detail'}
    <WorkoutPlanDetail planId={$nav.params.planId} />
  {:else}
    <Dashboard />
  {/if}
  <NavBar />
{:else}
  <Onboarding />
{/if}
LIFEQUEST_EOF

echo "Pronto. Rode: cd frontend && npm install && npm run dev"
