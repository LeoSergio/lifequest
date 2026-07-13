#!/usr/bin/env bash
set -e
# Rode a partir da raiz do repo lifequest (onde fica a pasta frontend/).
# Pré-requisito: já ter aplicado o script anterior (reforma treino/metricas).

mkdir -p "frontend/src/lib"
cat > "frontend/src/lib/metrics.js" << 'LIFEQUEST_EOF'
// Retorna a "segunda-feira" da semana de uma data, como string YYYY-MM-DD.
// Usamos isso como chave de agrupamento pra "quantos treinos por semana".
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak (ofensiva) calculado sempre a partir do histórico real de sessões
 * concluídas — nunca guardamos esse número num campo solto, pra não correr
 * risco de ele dessincronizar da realidade (ex: se uma sessão for apagada).
 */
export function currentStreak(sessions) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));

  let streak = 0;
  const cursor = new Date();

  // Se hoje ainda não treinou, começa a contagem em ontem — assim a
  // ofensiva não "quebra" visualmente só porque o dia ainda não acabou.
  if (!trainedDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (trainedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Últimos 7 dias, marcando quais tiveram treino concluído — pro calendário estilo Duolingo. */
export function last7DaysActivity(sessions) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));
  const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      label: dayLabels[d.getDay()],
      trained: trainedDays.has(iso),
      isToday: i === 0
    });
  }

  return days;
}

/**
 * Monta uma grade de semanas x dias (estilo GitHub/Duolingo) marcando em
 * quais dias houve treino concluído, pras últimas `weeks` semanas. Cada
 * semana começa na segunda-feira, igual ao resto do app (ver startOfWeek).
 */
export function weeklyCalendar(sessions, weeks = 9) {
  const trainedDays = new Set(sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10)));
  const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const currentWeekStart = new Date(startOfWeek(new Date()));
  const gridStart = new Date(currentWeekStart);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

  const columns = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(date.getDate() + w * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      days.push({ date: iso, trained: trainedDays.has(iso), isToday: iso === today, isFuture: iso > today });
    }
    columns.push({ days, monthLabel: monthLabels[new Date(days[0].date).getMonth()] });
  }

  return columns;
}

/**
 * Conta quantas sessões de treino finalizadas existem por semana,
 * nas últimas `weeksBack` semanas (incluindo a atual).
 */
export function sessionsPerWeek(sessions, weeksBack = 8) {
  const today = new Date();
  const weeks = [];

  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    weeks.push(startOfWeek(d));
  }

  const counts = Object.fromEntries(weeks.map((w) => [w, 0]));

  for (const session of sessions) {
    if (!session.finishedAt) continue; // só conta treino que foi concluído
    const week = startOfWeek(session.finishedAt);
    if (week in counts) counts[week] += 1;
  }

  return {
    labels: weeks.map((w) => {
      const [, m, d] = w.split('-');
      return `${d}/${m}`;
    }),
    data: weeks.map((w) => counts[w])
  };
}

/**
 * Maior peso registrado por dia, pra um conjunto de sessionSets de um
 * único exercício — vira a linha de progressão de carga no gráfico.
 */
export function maxWeightByDay(sessionSets) {
  const byDay = {};

  for (const set of sessionSets) {
    if (set.weightKg == null) continue;
    const day = set.completedAt.slice(0, 10);
    byDay[day] = Math.max(byDay[day] ?? 0, set.weightKg);
  }

  const days = Object.keys(byDay).sort();

  return {
    labels: days.map((d) => {
      const [, m, day] = d.split('-');
      return `${day}/${m}`;
    }),
    data: days.map((d) => byDay[d])
  };
}

/**
 * Igual a maxWeightByDay, mas agrupado por mês — melhor pra ver a
 * evolução de carga ao longo de várias semanas sem um gráfico lotado de
 * barras diárias. Mostra os últimos `monthsBack` meses, incluindo o atual.
 */
export function maxWeightByMonth(sessionSets, monthsBack = 6) {
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const today = new Date();

  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const byMonth = {};
  for (const set of sessionSets) {
    if (set.weightKg == null) continue;
    const month = set.completedAt.slice(0, 7);
    byMonth[month] = Math.max(byMonth[month] ?? 0, set.weightKg);
  }

  return {
    labels: months.map((m) => monthNames[Number(m.slice(5, 7)) - 1]),
    data: months.map((m) => byMonth[m] ?? null)
  };
}
LIFEQUEST_EOF

mkdir -p "frontend/src/components"
cat > "frontend/src/components/NavBar.svelte" << 'LIFEQUEST_EOF'
<script>
  import { nav, navigate } from '../lib/nav.js';

  // "Escanear" saiu da barra: o scan de nota fiscal agora vive dentro da
  // própria tela de Despensa (ver routes/Pantry.svelte), então não faz
  // sentido ocupar uma aba própria só pra isso.
  // Métricas não é uma aba própria: ela é uma "sub-tela" de Treino,
  // acessada por um botão dentro da lista de treinos (ver Training.svelte)
  // — assim como "novo treino" também não tem aba própria.
  const tabs = [
    { id: 'dashboard', label: 'Início', icon: '🏠' },
    { id: 'pantry', label: 'Despensa', icon: '🥫' },
    { id: 'habits', label: 'Hábitos', icon: '✅' },
    { id: 'goals', label: 'Metas', icon: '🏆' },
    { id: 'training', label: 'Treino', icon: '💪' }
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

  <button class="text-xs text-white/40 mb-6 flex items-center gap-1" on:click={() => navigate('training-metrics')}>
    📊 Ver métricas de desempenho
  </button>

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
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import { maxWeightByMonth, weeklyCalendar, currentStreak } from '../lib/metrics.js';

  // Vindo de "ver evolução deste treino" em WorkoutPlanDetail — se
  // presente, a aba de Desempenho já abre com esse treino selecionado.
  export let focusPlanId = null;

  let tab = 'desempenho'; // desempenho | perimetricas | consistencia

  // ---------- Desempenho (por treino, agrupado por mês) ----------
  // Antes isso era um dropdown achatado com TODO exercício de TODO
  // plano, e o link contextual tinha que "adivinhar" qual exercício
  // abrir (bug: sempre abria o primeiro da lista, então "Supino Reto"
  // podia aparecer vazio se não fosse o primeiro exercício do treino).
  // Agora escolhe-se o TREINO, e a tela mostra todos os exercícios dele
  // de uma vez — sem adivinhação nenhuma.
  const plans = liveQuery(() => db.workoutPlans.toArray());
  const allLinks = liveQuery(() => db.workoutPlanExercises.toArray());
  const catalog = liveQuery(() => db.exercises.toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  let selectedPlan = focusPlanId;

  $: if (selectedPlan == null && $plans && $plans.length > 0) selectedPlan = $plans[0].id;

  $: planExercises = ($allLinks ?? [])
    .filter((l) => l.workoutPlanId === selectedPlan)
    .sort((a, b) => a.order - b.order)
    .map((link) => ({
      ...link,
      exercise: ($catalog ?? []).find((e) => e.id === link.exerciseId) ?? { name: '(exercício removido)' },
      chart: $allSessionSets
        ? maxWeightByMonth($allSessionSets.filter((s) => s.exerciseId === link.exerciseId))
        : { labels: [], data: [] }
    }));

  // ---------- Perimétricas ----------
  // O gráfico de radar das circunferências saiu daqui: apontaram que não
  // era intuitivo. Ficam só os números da última medição e a evolução de
  // peso (um gráfico de linha simples, que é bem mais direto de ler).
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
    {#each [['desempenho', 'Desempenho'], ['perimetricas', 'Perimétricas'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'desempenho'}
    <section>
      {#if $plans === undefined || $plans.length === 0}
        <p class="text-sm text-white/40">Crie um treino em Treinos para ver a evolução de carga aqui.</p>
      {:else}
        <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-4" bind:value={selectedPlan}>
          {#each $plans as plan}
            <option value={plan.id}>{plan.name}</option>
          {/each}
        </select>

        {#if planExercises.length === 0}
          <p class="text-sm text-white/40">Esse treino ainda não tem exercícios cadastrados.</p>
        {:else}
          <div class="flex flex-col gap-4">
            {#each planExercises as pe (pe.id)}
              <div class="bg-surface rounded-xl p-4">
                <p class="text-sm font-semibold mb-2">{pe.exercise.name}</p>
                {#if pe.chart.data.every((v) => v == null)}
                  <p class="text-xs text-white/40">
                    Ainda sem sessões registradas para esse exercício. O gráfico se preenche quando você
                    treinar e registrar peso/reps.
                  </p>
                {:else}
                  <BarChart labels={pe.chart.labels} data={pe.chart.data} label="{pe.exercise.name} (kg/mês)" />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </section>
  {:else if tab === 'perimetricas'}
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
        <div class="bg-surface rounded-xl p-4 mb-4">
          <p class="text-xs text-white/40 mb-2">Peso ao longo do tempo</p>
          <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
        </div>
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

        {#if latestMeasurement}
          <p class="text-[11px] text-white/30">
            Última medição ({latestMeasurement.date}): ombro {latestMeasurement.shoulder ?? '-'}cm · tórax {latestMeasurement.chest ?? '-'}cm ·
            abdômen {latestMeasurement.abdomen ?? '-'}cm · coxa {latestMeasurement.thigh ?? '-'}cm
          </p>
        {/if}

        <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium text-sm">Registrar medição</button>
      </form>
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
    <TrainingMetrics focusPlanId={$nav.params.focusPlanId} />
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
