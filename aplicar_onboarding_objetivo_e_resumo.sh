#!/usr/bin/env bash
set -e
# Rode a partir da raiz do repo lifequest (onde fica a pasta frontend/).
# Pré-requisito: já ter aplicado os scripts anteriores.

mkdir -p "frontend/src/lib"
cat > "frontend/src/lib/constants.js" << 'LIFEQUEST_EOF'
// Lista fixa pra manter simples no MVP. Se um dia precisar ser dinâmico
// (usuário criando categorias próprias), isso vira uma tabela no Dexie.
export const PANTRY_CATEGORIES = [
  'Proteínas',
  'Carboidratos',
  'Vegetais',
  'Frutas',
  'Laticínios',
  'Temperos',
  'Outros'
];

export const MUSCLE_GROUPS = ['Peito', 'Costas', 'Bíceps', 'Tríceps', 'Pernas', 'Ombro', 'Core'];

export const EQUIPMENT_TYPES = ['Peso livre', 'Máquina', 'Barra', 'Halteres', 'Peso corporal'];

export const WEEKDAYS = [
  { value: null, label: 'Livre' },
  { value: 'seg', label: 'Segunda' },
  { value: 'ter', label: 'Terça' },
  { value: 'qua', label: 'Quarta' },
  { value: 'qui', label: 'Quinta' },
  { value: 'sex', label: 'Sexta' },
  { value: 'sab', label: 'Sábado' },
  { value: 'dom', label: 'Domingo' }
];

// Objetivo escolhido no onboarding — usado pra colorir o resumo semanal
// da Dashboard (ex: perder peso e o peso caiu = progresso; ganhar peso e
// o peso caiu = alerta), não pra travar nenhuma funcionalidade.
export const GOALS = [
  { value: 'lose_weight', label: 'Perder peso' },
  { value: 'gain_weight', label: 'Ganhar peso' },
  { value: 'gain_muscle', label: 'Ganhar massa muscular' },
  { value: 'maintain', label: 'Manter o peso' }
];
LIFEQUEST_EOF

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
 * Intervalo de datas (YYYY-MM-DD) pro resumo da Dashboard, no estilo dos
 * filtros do MyFitnessPal (semana / mês / trimestre), sempre terminando
 * hoje.
 */
export function periodRange(period) {
  const end = new Date();
  const start = new Date();

  if (period === 'semana') start.setDate(end.getDate() - 6);
  else if (period === 'mes') start.setDate(end.getDate() - 29);
  else start.setDate(end.getDate() - 89); // trimestre ~ 90 dias

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Quantos treinos foram concluídos dentro do intervalo. */
export function workoutsInRange(sessions, range) {
  return sessions.filter((s) => s.finishedAt && s.finishedAt.slice(0, 10) >= range.start && s.finishedAt.slice(0, 10) <= range.end)
    .length;
}

/**
 * Taxa de conclusão de hábitos diários dentro do intervalo — mesma ideia
 * de successRate() em lib/habits.js, mas pro período escolhido no filtro
 * em vez de fixo em 7 dias. Ignora dias anteriores à criação do hábito,
 * pra não punir um hábito novo por dias em que ele nem existia ainda.
 */
export function habitsCompletionRateInRange(habits, completions, range) {
  const dailyHabits = habits.filter((h) => h.cadence === 'daily' && !h.archivedAt);
  if (dailyHabits.length === 0) return null;

  let total = 0;
  let hit = 0;
  const cursor = new Date(range.start);
  const endDate = new Date(range.end);

  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    for (const habit of dailyHabits) {
      if (habit.createdAt && habit.createdAt.slice(0, 10) > iso) continue;
      total += 1;
      if (completions.some((c) => c.habitId === habit.id && c.date === iso)) hit += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total === 0 ? null : Math.round((hit / total) * 100);
}

/**
 * Variação de peso dentro do intervalo, a partir do histórico real de
 * bodyMeasurements (nunca um número solto) — junto com os pontos pra
 * desenhar a mini linha de tendência.
 */
export function weightDeltaInRange(measurements, range) {
  const inRange = measurements
    .filter((m) => m.weight != null && m.date >= range.start && m.date <= range.end)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (inRange.length < 2) return null;

  const first = inRange[0].weight;
  const last = inRange[inRange.length - 1].weight;

  return {
    first,
    last,
    delta: Math.round((last - first) * 10) / 10,
    labels: inRange.map((m) => m.date.slice(5).split('-').reverse().join('/')),
    data: inRange.map((m) => m.weight)
  };
}

/** Quantas metas foram alcançadas dentro do intervalo. */
export function goalsAchievedInRange(goals, range) {
  return goals.filter((g) => g.achievedAt && g.achievedAt.slice(0, 10) >= range.start && g.achievedAt.slice(0, 10) <= range.end)
    .length;
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

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/Onboarding.svelte" << 'LIFEQUEST_EOF'
<script>
  import { db } from '../db/db.js';
  import { GOALS } from '../lib/constants.js';

  // Onboarding em 3 passos curtos: nome, objetivo, métricas básicas.
  // Nada de quiz nem chamada de IA — o app funciona 100% offline desde o
  // primeiro segundo. Perimetria detalhada (circunferências etc.) fica
  // pra tela de Métricas, quando o usuário quiser se aprofundar depois.
  let step = 1;
  const totalSteps = 3;

  let name = '';
  let goal = null;

  let age = '';
  let weight = '';
  let height = '';

  let saving = false;

  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  function next() {
    if (step === 1 && !name.trim()) return;
    if (step === 2 && !goal) return;
    step += 1;
  }

  function back() {
    step -= 1;
  }

  async function finish() {
    if (!name.trim() || !goal || saving) return;
    saving = true;

    try {
      await db.player.add({
        name: name.trim(),
        goal,
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      // Métricas básicas são opcionais — só grava se pelo menos uma foi
      // preenchida, pra não criar uma medição vazia sem sentido.
      if (age || weight || height) {
        await db.bodyMeasurements.add({
          date: new Date().toISOString().slice(0, 10),
          age: age === '' ? null : Number(age),
          weight: weight === '' ? null : Number(weight),
          height: height === '' ? null : Number(height),
          shoulder: null,
          chest: null,
          abdomen: null,
          thigh: null,
          calf: null,
          armLeft: null,
          armRight: null,
          forearm: null
        });
      }

      // A partir daqui, o App.svelte percebe (via liveQuery) que já existe
      // um player e troca pra tela de Início sozinho.
      await db.habits.bulkAdd(
        starterHabits.map((h) => ({ ...h, archivedAt: null, createdAt: new Date().toISOString() }))
      );
    } finally {
      saving = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  <div class="w-full max-w-sm flex flex-col items-center gap-5">
    <div class="flex gap-1.5">
      {#each Array(totalSteps) as _, i}
        <span class="w-6 h-1.5 rounded-full {i + 1 <= step ? 'bg-primary' : 'bg-white/10'}"></span>
      {/each}
    </div>

    {#if step === 1}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">✨</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Bem-vindo ao LifeQuest</h1>
          <p class="text-sm text-white/60">Como podemos te chamar?</p>
        </div>

        <form on:submit|preventDefault={next} class="w-full flex flex-col gap-3">
          <input
            class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-center"
            placeholder="Seu nome"
            bind:value={name}
            autofocus
          />
          <button type="submit" class="bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40" disabled={!name.trim()}>
            Continuar
          </button>
        </form>
      </div>
    {:else if step === 2}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🎯</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Qual é o seu objetivo?</h1>
          <p class="text-sm text-white/60">Isso ajuda a personalizar seu resumo de progresso.</p>
        </div>

        <div class="w-full flex flex-col gap-2">
          {#each GOALS as g}
            <button
              class="w-full rounded-xl py-3 text-sm font-medium border {goal === g.value ? 'bg-primary text-white border-primary' : 'bg-surface border-white/10 text-white/80'}"
              on:click={() => (goal = g.value)}
            >
              {g.label}
            </button>
          {/each}
        </div>

        <div class="w-full flex gap-2">
          <button class="flex-1 bg-white/10 rounded-xl py-3 text-sm" on:click={back}>Voltar</button>
          <button class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40" disabled={!goal} on:click={next}>
            Continuar
          </button>
        </div>
      </div>
    {:else}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">📏</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Só mais um pouco</h1>
          <p class="text-sm text-white/60">
            Idade, peso e altura de hoje — pra você acompanhar sua evolução depois. Pode pular se preferir.
          </p>
        </div>

        <div class="w-full grid grid-cols-3 gap-2">
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Idade" bind:value={age} />
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Peso (kg)" bind:value={weight} />
          <input type="number" class="bg-surface border border-white/10 rounded-xl px-2 py-3 text-sm text-center" placeholder="Altura (cm)" bind:value={height} />
        </div>

        <p class="text-[11px] text-white/30 -mt-2">
          Medidas mais detalhadas (circunferências etc.) você registra depois, em Treino → Métricas.
        </p>

        <div class="w-full flex gap-2">
          <button class="flex-1 bg-white/10 rounded-xl py-3 text-sm" on:click={back}>Voltar</button>
          <button class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40" disabled={saving} on:click={finish}>
            {saving ? 'Preparando...' : 'Começar jornada'}
          </button>
        </div>

        <button class="text-xs text-white/30" on:click={finish} disabled={saving}>Pular por agora →</button>
      </div>
    {/if}
  </div>
</main>
LIFEQUEST_EOF

mkdir -p "frontend/src/components"
cat > "frontend/src/components/PeriodSummary.svelte" << 'LIFEQUEST_EOF'
<script>
  import { periodRange, workoutsInRange, habitsCompletionRateInRange, weightDeltaInRange, goalsAchievedInRange } from '../lib/metrics.js';
  import LineChart from './LineChart.svelte';

  export let sessions = [];
  export let habits = [];
  export let completions = [];
  export let measurements = [];
  export let goals = [];
  export let playerGoal = null; // 'lose_weight' | 'gain_weight' | 'gain_muscle' | 'maintain'

  let period = 'semana'; // semana | mes | trimestre

  $: range = periodRange(period);
  $: workouts = workoutsInRange(sessions, range);
  $: habitRate = habitsCompletionRateInRange(habits, completions, range);
  $: weightTrend = weightDeltaInRange(measurements, range);
  $: goalsAchieved = goalsAchievedInRange(goals, range);

  // No estilo MyFitnessPal: a variação de peso é "boa" ou "ruim" conforme
  // o objetivo escolhido no onboarding, não tem cor fixa.
  $: weightTone = (() => {
    if (!weightTrend) return 'neutral';
    if (playerGoal === 'lose_weight') return weightTrend.delta < 0 ? 'good' : weightTrend.delta > 0 ? 'bad' : 'neutral';
    if (playerGoal === 'gain_weight' || playerGoal === 'gain_muscle') {
      return weightTrend.delta > 0 ? 'good' : weightTrend.delta < 0 ? 'bad' : 'neutral';
    }
    return Math.abs(weightTrend.delta) <= 0.5 ? 'good' : 'neutral'; // manter peso
  })();

  const toneClass = { good: 'text-xp', bad: 'text-danger', neutral: 'text-white/70' };
</script>

<div class="bg-surface rounded-xl p-4">
  <div class="flex justify-between items-center mb-3">
    <h2 class="text-sm uppercase text-white/40">Resumo</h2>
    <div class="flex bg-bg rounded-lg p-0.5 text-[11px]">
      {#each [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre']] as [value, label]}
        <button
          class="px-2.5 py-1 rounded-md transition-colors {period === value ? 'bg-primary text-white' : 'text-white/40'}"
          on:click={() => (period = value)}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  {#if weightTrend}
    <div class="mb-3">
      <div class="flex items-baseline gap-2 mb-1">
        <span class="text-lg font-bold {toneClass[weightTone]}">
          {weightTrend.delta > 0 ? '+' : ''}{weightTrend.delta}kg
        </span>
        <span class="text-xs text-white/40">no período · agora {weightTrend.last}kg</span>
      </div>
      <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
    </div>
  {/if}

  <div class="grid grid-cols-3 gap-2">
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{workouts}</p>
      <p class="text-[10px] text-white/40">treinos</p>
    </div>
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{habitRate != null ? `${habitRate}%` : '-'}</p>
      <p class="text-[10px] text-white/40">hábitos</p>
    </div>
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{goalsAchieved}</p>
      <p class="text-[10px] text-white/40">metas batidas</p>
    </div>
  </div>

  {#if !weightTrend}
    <p class="text-[11px] text-white/30 mt-3">
      Registre pelo menos 2 medições de peso no período (em Treino → Métricas) pra ver a tendência aqui.
    </p>
  {/if}
</div>
LIFEQUEST_EOF

mkdir -p "frontend/src/components"
cat > "frontend/src/components/Dashboard.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import { completedToday, todayIso } from '../lib/habits.js';
  import { WEEKDAYS } from '../lib/constants.js';
  import { navigate } from '../lib/nav.js';
  import StatsBar from '../components/StatsBar.svelte';
  import StreakCalendar from '../components/StreakCalendar.svelte';
  import PeriodSummary from '../components/PeriodSummary.svelte';

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  const plans = liveQuery(() => db.workoutPlans.toArray());
  const measurements = liveQuery(() => db.bodyMeasurements.toArray());
  const goals = liveQuery(() => db.goals.toArray());

  // Streak sempre derivado do histórico de sessões — nunca lido de um
  // campo "streak" guardado solto (ver comentário em lib/metrics.js).
  $: streak = $sessions ? currentStreak($sessions) : 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];

  // Hábitos diários ainda não marcados hoje — o que sobrou de "Missões de
  // hoje" na prática, só que agora vindo do sistema de Hábitos.
  $: pendingHabits = ($habits ?? [])
    .filter((h) => h.cadence === 'daily' && !completedToday(h.id, $completions ?? []))
    .slice(0, 2);

  // JS getDay(): 0=domingo...6=sábado. Convertendo pro formato usado em
  // WEEKDAYS ('seg'..'dom') pra achar o próximo treino agendado.
  const dayCodes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  $: nextWorkout = (() => {
    const scheduled = ($plans ?? []).filter((p) => p.weekday);
    if (scheduled.length === 0) return null;

    const todayIdx = new Date().getDay();
    for (let i = 0; i < 7; i++) {
      const code = dayCodes[(todayIdx + i) % 7];
      const match = scheduled.find((p) => p.weekday === code);
      if (match) return { plan: match, inDays: i };
    }
    return null;
  })();

  function weekdayLabel(value) {
    return WEEKDAYS.find((w) => w.value === value)?.label ?? '';
  }

  async function completeHabit(habit) {
    if (completedToday(habit.id, $completions ?? [])) return;

    await db.habitCompletions.add({ habitId: habit.id, date: todayIso() });

    const current = await db.player.toCollection().first();
    const { level, xp, leveledUp } = applyXp(current.level, current.xp, habit.xpReward ?? 10);
    await db.player.update(current.id, { level, xp });

    if (leveledUp) {
      alert(`Level up! Agora você é nível ${level} 🎉`);
    }
  }
</script>

<main class="min-h-screen p-6 pb-24 flex flex-col gap-6 max-w-md mx-auto">
  {#if $player}
    <div>
      <p class="text-sm text-white/50">Olá{$player.name ? `, ${$player.name}` : ''} 👋</p>
      <h1 class="text-2xl font-bold text-primary">Início</h1>
    </div>

    <StatsBar level={$player.level} xp={$player.xp} {streak} />
  {/if}

  <StreakCalendar days={weekActivity} {streak} />

  <PeriodSummary
    sessions={$sessions ?? []}
    habits={$habits ?? []}
    completions={$completions ?? []}
    measurements={$measurements ?? []}
    goals={$goals ?? []}
    playerGoal={$player?.goal}
  />

  <!-- Próximas ações: une o próximo treino agendado e os hábitos do dia
       ainda pendentes num único carrossel horizontal, em vez de dois
       cards competindo pela mesma atenção. -->
  {#if nextWorkout || pendingHabits.length > 0}
    <div>
      <h2 class="text-sm uppercase text-white/40 mb-3">Próximas ações</h2>
      <div class="flex gap-3 overflow-x-auto pb-1">
        {#if nextWorkout}
          <button
            class="shrink-0 w-44 bg-surface rounded-xl p-4 text-left"
            on:click={() => navigate('workout-plan-detail', { planId: nextWorkout.plan.id })}
          >
            <span class="text-xl block mb-2">💪</span>
            <p class="text-sm font-semibold truncate">{nextWorkout.plan.name}</p>
            <p class="text-xs text-white/40 mt-1">
              {nextWorkout.inDays === 0 ? 'Hoje' : weekdayLabel(nextWorkout.plan.weekday)}
              {#if nextWorkout.plan.estimatedDuration}· ~{nextWorkout.plan.estimatedDuration} min{/if}
            </p>
          </button>
        {/if}

        {#each pendingHabits as habit (habit.id)}
          <button class="shrink-0 w-44 bg-surface rounded-xl p-4 text-left" on:click={() => completeHabit(habit)}>
            <span class="text-xl block mb-2">{habit.icon ?? '🔥'}</span>
            <p class="text-sm font-semibold truncate">{habit.title}</p>
            <p class="text-xs text-xp mt-1">+{habit.xpReward ?? 10} XP · toque p/ concluir</p>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <button class="text-xs text-white/40 text-left -mt-3" on:click={() => navigate('habits')}>
    Ver todos os hábitos →
  </button>
</main>
LIFEQUEST_EOF

echo "Pronto. Rode: cd frontend && npm install && npm run dev"
