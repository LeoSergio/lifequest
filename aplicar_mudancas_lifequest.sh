#!/usr/bin/env bash
set -e
# Rode este script a partir da raiz do repo lifequest (onde fica a pasta frontend/).
echo "Removendo rota de scan standalone e MissionCard (absorvidos)..."
rm -f frontend/src/routes/ScanReceipt.svelte frontend/src/components/MissionCard.svelte

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

export default db;
LIFEQUEST_EOF

mkdir -p "frontend/src/lib"
cat > "frontend/src/lib/habits.js" << 'LIFEQUEST_EOF'
// Funções de derivação de estado dos hábitos — segue o mesmo princípio de
// metrics.js: nunca guardamos "streak" como campo solto no hábito, sempre
// recalculamos a partir do histórico real de conclusões (habitCompletions).
// Isso evita o número dessincronizar da realidade se uma conclusão for
// apagada ou editada.

function startOfWeekIso(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Streak (dias consecutivos) de um hábito diário, terminando hoje ou ontem. */
export function habitStreak(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));

  let streak = 0;
  const cursor = new Date();

  // Se hoje ainda não foi marcado, começa a contagem em ontem — assim a
  // ofensiva não "quebra" visualmente só porque o dia ainda não acabou.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Últimos 7 dias marcando se o hábito foi concluído em cada um (pontinhos S T Q Q S S D). */
export function last7Days(habitId, completions) {
  const days = new Set(completions.filter((c) => c.habitId === habitId).map((c) => c.date));
  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ date: iso, label: labels[d.getDay()], done: days.has(iso), isToday: i === 0 });
  }

  return result;
}

/** Para hábitos de meta semanal (ex: "treinar 4x/semana"): quantas conclusões nesta semana. */
export function weeklyCount(habitId, completions) {
  const week = startOfWeekIso(new Date());
  return completions.filter((c) => c.habitId === habitId && startOfWeekIso(c.date) === week).length;
}

/** Já foi concluído hoje? Evita marcar 2x o mesmo hábito diário no mesmo dia. */
export function completedToday(habitId, completions) {
  const today = todayIso();
  return completions.some((c) => c.habitId === habitId && c.date === today);
}

/**
 * Taxa de sucesso agregada dos últimos 7 dias: de todas as ocorrências
 * esperadas de hábitos diários ativos, quantas foram cumpridas. Hábitos
 * semanais não entram nessa conta (têm sua própria barra de progresso).
 */
export function successRate(habits, completions) {
  const dailyHabits = habits.filter((h) => h.cadence === 'daily' && !h.archivedAt);
  if (dailyHabits.length === 0) return 0;

  let total = 0;
  let hit = 0;
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    for (const habit of dailyHabits) {
      total += 1;
      if (completions.some((c) => c.habitId === habit.id && c.date === iso)) hit += 1;
    }
  }

  return total === 0 ? 0 : Math.round((hit / total) * 100);
}
LIFEQUEST_EOF

mkdir -p "frontend/src/components"
cat > "frontend/src/components/HabitCard.svelte" << 'LIFEQUEST_EOF'
<script>
  import { createEventDispatcher } from 'svelte';
  import { last7Days, weeklyCount, completedToday, habitStreak } from '../lib/habits.js';

  export let habit;
  export let completions = [];
  // 'compact' é usado na Dashboard (só o essencial); 'full' é usado na
  // tela de Hábitos (com os pontinhos da semana / barra de progresso).
  export let variant = 'full';

  const dispatch = createEventDispatcher();

  $: done = completedToday(habit.id, completions);
  $: weekDots = habit.cadence === 'daily' ? last7Days(habit.id, completions) : [];
  $: weekCount = habit.cadence === 'weekly' ? weeklyCount(habit.id, completions) : 0;
  $: streakDays = habit.cadence === 'daily' ? habitStreak(habit.id, completions) : 0;
</script>

<div class="bg-surface rounded-xl p-4">
  <div class="flex items-center gap-3">
    <span class="text-xl shrink-0">{habit.icon ?? '🔥'}</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold truncate">{habit.title}</h3>
        {#if variant === 'full' && habit.cadence === 'daily' && streakDays > 0}
          <span class="shrink-0 text-[11px] text-xp flex items-center gap-0.5">🔥{streakDays}d</span>
        {/if}
      </div>
      {#if variant === 'full'}
        <p class="text-xs text-white/40">{habit.cadence === 'weekly' ? 'Meta semanal' : 'Meta diária'}</p>
      {/if}
    </div>

    {#if habit.cadence === 'daily'}
      <button
        class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors
          {done ? 'bg-xp' : 'bg-white/10'}"
        disabled={done}
        on:click={() => dispatch('complete', habit)}
        aria-label={done ? 'Já concluído hoje' : 'Marcar como concluído hoje'}
      >
        {done ? '✅' : ''}
      </button>
    {:else}
      <button
        class="shrink-0 bg-primary text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40"
        disabled={weekCount >= habit.weeklyTarget}
        on:click={() => dispatch('complete', habit)}
      >
        +1
      </button>
    {/if}
  </div>

  {#if variant === 'full' && habit.cadence === 'daily'}
    <div class="flex justify-between mt-3">
      {#each weekDots as day}
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px]
            {day.done ? 'bg-primary text-white' : 'bg-white/10 text-white/30'}"
        >
          {day.label}
        </span>
      {/each}
    </div>
  {:else if variant === 'full' && habit.cadence === 'weekly'}
    <div class="mt-3">
      <p class="text-[11px] text-white/40 mb-1">{weekCount}/{habit.weeklyTarget} esta semana</p>
      <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-primary h-1.5 rounded-full transition-all"
          style="width: {Math.min(100, Math.round((weekCount / habit.weeklyTarget) * 100))}%"
        ></div>
      </div>
    </div>
  {/if}
</div>
LIFEQUEST_EOF

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/Habits.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { successRate, todayIso, weeklyCount, completedToday } from '../lib/habits.js';
  import HabitCard from '../components/HabitCard.svelte';

  const allHabits = liveQuery(() => db.habits.toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());

  let tab = 'ativos'; // ativos | todos | concluidos
  let showForm = false;

  let title = '';
  let icon = '🔥';
  let cadence = 'daily';
  let weeklyTarget = 3;

  // "Concluídos" aqui é o hábito como um todo (arquivado, ex: um desafio de
  // 30 dias que terminou) — diferente de "marcar hoje", que é a conclusão
  // do dia. Ver comentário no schema (db.js) e em lib/habits.js.
  $: filtered = ($allHabits ?? []).filter((h) => {
    if (tab === 'ativos') return !h.archivedAt;
    if (tab === 'concluidos') return !!h.archivedAt;
    return true;
  });

  $: activeHabits = ($allHabits ?? []).filter((h) => !h.archivedAt);
  $: rate = $allHabits && $completions ? successRate($allHabits, $completions) : 0;

  // Sequência atual exibida nas estatísticas = maior streak entre os
  // hábitos diários ativos, pra dar um número único e animador no topo.
  $: bestStreak = (() => {
    if (!$allHabits || !$completions) return 0;
    let best = 0;
    for (const h of activeHabits) {
      if (h.cadence !== 'daily') continue;
      const days = new Set($completions.filter((c) => c.habitId === h.id).map((c) => c.date));
      let streak = 0;
      const cursor = new Date();
      if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      best = Math.max(best, streak);
    }
    return best;
  })();

  async function completeHabit(event) {
    const habit = event.detail;

    if (habit.cadence === 'daily' && completedToday(habit.id, $completions ?? [])) return;
    if (habit.cadence === 'weekly' && weeklyCount(habit.id, $completions ?? []) >= habit.weeklyTarget) return;

    await db.habitCompletions.add({ habitId: habit.id, date: todayIso() });

    const player = await db.player.toCollection().first();
    if (player) {
      const { level, xp, leveledUp } = applyXp(player.level, player.xp, habit.xpReward ?? 10);
      await db.player.update(player.id, { level, xp });
      if (leveledUp) alert(`Level up! Agora você é nível ${level} 🎉`);
    }
  }

  async function createHabit() {
    if (!title.trim()) return;

    await db.habits.add({
      title: title.trim(),
      icon: icon.trim() || '🔥',
      cadence,
      weeklyTarget: cadence === 'weekly' ? Number(weeklyTarget) || 3 : null,
      xpReward: 10,
      archivedAt: null,
      createdAt: new Date().toISOString()
    });

    title = '';
    icon = '🔥';
    cadence = 'daily';
    weeklyTarget = 3;
    showForm = false;
  }

  async function archiveHabit(id) {
    await db.habits.update(id, { archivedAt: new Date().toISOString() });
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <div class="flex justify-between items-start mb-1">
    <div>
      <h1 class="text-2xl font-bold text-primary">Hábitos</h1>
      <p class="text-sm text-white/60">Crie hábitos saudáveis e acompanhe sua consistência.</p>
    </div>
    <button
      class="shrink-0 bg-primary text-white rounded-full px-3 py-2 text-xs font-medium"
      on:click={() => (showForm = !showForm)}
    >
      + Novo hábito
    </button>
  </div>

  {#if showForm}
    <form on:submit|preventDefault={createHabit} class="bg-surface rounded-xl p-4 my-4 flex flex-col gap-3">
      <input
        class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Nome do hábito (ex: beber 2L de água)"
        bind:value={title}
      />

      <div class="flex gap-2">
        <input
          class="w-16 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm text-center"
          bind:value={icon}
        />
        <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={cadence}>
          <option value="daily">Meta diária</option>
          <option value="weekly">Meta semanal</option>
        </select>
      </div>

      {#if cadence === 'weekly'}
        <input
          type="number"
          min="1"
          max="7"
          class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="Quantas vezes por semana?"
          bind:value={weeklyTarget}
        />
      {/if}

      <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">Criar hábito</button>
    </form>
  {/if}

  <div class="flex bg-surface rounded-xl p-1 my-4 text-sm">
    {#each [['ativos', 'Ativos'], ['todos', 'Todos'], ['concluidos', 'Concluídos']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if $allHabits === undefined}
    <p class="text-sm text-white/40">Carregando hábitos...</p>
  {:else if filtered.length === 0}
    <p class="text-sm text-white/40">
      {tab === 'concluidos' ? 'Nenhum hábito concluído ainda.' : 'Nenhum hábito por aqui ainda. Crie o primeiro acima.'}
    </p>
  {:else}
    <div class="flex flex-col gap-3 mb-6">
      {#each filtered as habit (habit.id)}
        <div>
          <HabitCard {habit} completions={$completions ?? []} on:complete={completeHabit} />
          {#if !habit.archivedAt}
            <button class="text-[10px] text-white/30 mt-1 ml-1" on:click={() => archiveHabit(habit.id)}>
              marcar hábito como concluído (arquivar)
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <p class="text-xs uppercase text-white/40 mb-2">Estatísticas</p>
  <div class="grid grid-cols-3 gap-2">
    <div class="bg-surface rounded-xl p-3 text-center">
      <p class="text-lg font-bold">{activeHabits.length}</p>
      <p class="text-[11px] text-white/40">Hábitos ativos</p>
    </div>
    <div class="bg-surface rounded-xl p-3 text-center">
      <p class="text-lg font-bold">{bestStreak}</p>
      <p class="text-[11px] text-white/40">Sequência atual</p>
    </div>
    <div class="bg-surface rounded-xl p-3 text-center">
      <p class="text-lg font-bold">{rate}%</p>
      <p class="text-[11px] text-white/40">Taxa de sucesso</p>
    </div>
  </div>
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
  {:else if $nav.name === 'training'}
    <Training />
  {:else if $nav.name === 'training-new'}
    <NewWorkoutPlan />
  {:else if $nav.name === 'training-metrics'}
    <TrainingMetrics />
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

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/Pantry.svelte" << 'LIFEQUEST_EOF'
<script>
  import { liveQuery } from 'dexie';
  import Tesseract from 'tesseract.js';
  import { db } from '../db/db.js';
  import { PANTRY_CATEGORIES } from '../lib/constants.js';
  import { extractItemCandidates } from '../lib/receiptParser.js';

  // bind:value liga o input DIRETO a essas variáveis — sempre que o
  // usuário digita, a variável muda sozinha (é bidirecional, diferente
  // do onChange manual do React). Por isso não precisamos de handler
  // pra atualizar `name`, `category` ou `quantity`.
  let name = '';
  let category = PANTRY_CATEGORIES[0];
  let quantity = '';

  // Estado do scanner de nota fiscal, agora embutido aqui (antes era a
  // rota separada /scan). 'idle' | 'processing' | 'review'.
  let scanStatus = 'idle';
  let scanProgress = 0;
  let candidates = []; // [{ name, category, checked }]
  let scanError = null;

  let cameraInput;
  let galleryInput;

  const items = liveQuery(() => db.pantryItems.toArray());

  // Deriva os itens agrupados por categoria sempre que `items` muda.
  // $: é uma "reactive statement" do Svelte: roda de novo toda vez que
  // qualquer variável usada dentro dela muda.
  $: grouped = groupByCategory($items ?? []);

  function groupByCategory(list) {
    const map = {};
    for (const c of PANTRY_CATEGORIES) map[c] = [];
    for (const item of list) {
      (map[item.category] ??= []).push(item);
    }
    return map;
  }

  async function addItem() {
    if (!name.trim()) return;

    await db.pantryItems.add({
      name: name.trim(),
      category,
      quantity: quantity.trim() || null,
      updatedAt: new Date().toISOString()
    });

    name = '';
    quantity = '';
  }

  async function removeItem(id) {
    await db.pantryItems.delete(id);
  }

  async function handleScanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    scanStatus = 'processing';
    scanProgress = 0;
    scanError = null;

    try {
      // 'por' = pacote de idioma português. Na primeira vez, o Tesseract
      // baixa esse pacote de treino (alguns MB) de uma CDN e guarda em
      // cache no navegador — por isso a primeira leitura é mais lenta.
      const { data } = await Tesseract.recognize(file, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            scanProgress = Math.round(m.progress * 100);
          }
        }
      });

      const found = extractItemCandidates(data.text);
      candidates = found.map((n) => ({
        name: n,
        category: PANTRY_CATEGORIES[PANTRY_CATEGORIES.length - 1], // 'Outros' por padrão
        checked: true
      }));
      scanStatus = 'review';
    } catch (e) {
      console.error(e);
      scanError = 'Não consegui ler essa imagem. Tenta uma foto mais nítida e com boa luz.';
      scanStatus = 'idle';
    } finally {
      // Limpa o input pra permitir escanear o mesmo arquivo de novo, se precisar.
      event.target.value = '';
    }
  }

  async function confirmScan() {
    const toAdd = candidates.filter((c) => c.checked && c.name.trim());

    await db.pantryItems.bulkAdd(
      toAdd.map((c) => ({
        name: c.name.trim(),
        category: c.category,
        quantity: null,
        updatedAt: new Date().toISOString()
      }))
    );

    resetScan();
  }

  function resetScan() {
    scanStatus = 'idle';
    candidates = [];
    scanProgress = 0;
    scanError = null;
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <h1 class="text-2xl font-bold text-primary mb-1">Despensa</h1>
  <p class="text-sm text-white/60 mb-6">O que você tem em casa agora.</p>

  <!-- Scan de nota fiscal: antes era uma aba própria, agora vive aqui
       dentro, já que o resultado dele é sempre "itens da despensa". -->
  {#if scanStatus === 'idle'}
    <div class="bg-surface rounded-xl p-4 mb-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">📷</span>
        <div>
          <p class="text-sm font-medium">Escanear nota fiscal</p>
          <p class="text-xs text-white/40">Tudo processado no aparelho — a imagem nunca sai do dispositivo.</p>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 bg-bg border border-white/10 rounded-lg py-3 text-sm flex flex-col items-center gap-1"
          on:click={() => cameraInput.click()}
        >
          <span class="text-xl">📷</span>
          Câmera
        </button>
        <button
          class="flex-1 bg-bg border border-white/10 rounded-lg py-3 text-sm flex flex-col items-center gap-1"
          on:click={() => galleryInput.click()}
        >
          <span class="text-xl">🖼️</span>
          Galeria
        </button>
      </div>

      <!-- capture="environment" força a abertura direta da câmera traseira. -->
      <input
        bind:this={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        on:change={handleScanFile}
      />
      <!-- Sem o atributo capture, o navegador abre o seletor normal (galeria/arquivos). -->
      <input bind:this={galleryInput} type="file" accept="image/*" class="hidden" on:change={handleScanFile} />

      {#if scanError}
        <p class="text-danger text-sm mt-3">{scanError}</p>
      {/if}
    </div>
  {:else if scanStatus === 'processing'}
    <div class="bg-surface rounded-xl p-6 text-center mb-6">
      <p class="text-sm text-white/60 mb-3">Lendo a nota fiscal...</p>
      <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div class="bg-primary h-2 rounded-full transition-all" style="width: {scanProgress}%"></div>
      </div>
      <p class="text-xs text-white/40 mt-2">{scanProgress}%</p>
    </div>
  {:else if scanStatus === 'review'}
    <div class="bg-surface rounded-xl p-4 mb-6">
      <p class="text-sm text-white/60 mb-3">
        Encontrei {candidates.length} possíveis itens. Revise antes de adicionar — o OCR erra às vezes.
      </p>

      {#if candidates.length === 0}
        <p class="text-sm text-white/40 mb-4">Não consegui identificar itens nessa imagem.</p>
      {:else}
        <div class="flex flex-col gap-2 mb-4">
          {#each candidates as c}
            <div class="bg-bg rounded-lg p-3 flex items-center gap-2">
              <input type="checkbox" bind:checked={c.checked} class="shrink-0" />
              <input class="flex-1 bg-surface border border-white/10 rounded px-2 py-2 text-sm min-w-0" bind:value={c.name} />
              <select class="bg-surface border border-white/10 rounded px-2 py-2 text-xs shrink-0" bind:value={c.category}>
                {#each PANTRY_CATEGORIES as cat}
                  <option value={cat}>{cat}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex gap-2">
        <button class="flex-1 bg-white/10 text-white rounded-lg py-3 text-sm" on:click={resetScan}>
          Tentar outra foto
        </button>
        <button
          class="flex-1 bg-primary text-white rounded-lg py-3 text-sm font-medium disabled:opacity-40"
          disabled={candidates.filter((c) => c.checked).length === 0}
          on:click={confirmScan}
        >
          Adicionar à despensa
        </button>
      </div>
    </div>
  {/if}

  <form on:submit|preventDefault={addItem} class="bg-surface rounded-xl p-4 mb-6 flex flex-col gap-3">
    <input
      class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
      placeholder="Nome do item (ex: ovos)"
      bind:value={name}
    />

    <div class="flex gap-2">
      <select class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={category}>
        {#each PANTRY_CATEGORIES as c}
          <option value={c}>{c}</option>
        {/each}
      </select>

      <input
        class="w-28 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Qtd (opc.)"
        bind:value={quantity}
      />
    </div>

    <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">
      Adicionar
    </button>
  </form>

  {#if $items === undefined}
    <p class="text-sm text-white/40">Carregando despensa...</p>
  {:else}
    {#each PANTRY_CATEGORIES as category}
      {#if grouped[category]?.length > 0}
        <div class="mb-5">
          <h2 class="text-xs uppercase text-white/40 mb-2">{category}</h2>
          <div class="flex flex-col gap-2">
            {#each grouped[category] as item (item.id)}
              <div class="bg-surface rounded-lg px-4 py-3 flex justify-between items-center">
                <div>
                  <span class="text-sm">{item.name}</span>
                  {#if item.quantity}
                    <span class="text-xs text-white/40 ml-2">{item.quantity}</span>
                  {/if}
                </div>
                <button class="text-white/40 text-sm" on:click={() => removeItem(item.id)}>
                  remover
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}

    {#if $items.length === 0}
      <p class="text-sm text-white/40">Despensa vazia. Adicione o primeiro item acima ou escaneie uma nota.</p>
    {/if}
  {/if}
</main>
LIFEQUEST_EOF

mkdir -p "frontend/src/routes"
cat > "frontend/src/routes/Onboarding.svelte" << 'LIFEQUEST_EOF'
<script>
  import { db } from '../db/db.js';

  // Onboarding simplificado: só pedimos o nome, sem quiz de arquétipo e
  // sem chamada de IA no primeiro acesso. Isso tem uma vantagem prática
  // além da simplicidade: o app agora funciona 100% offline desde o
  // primeiro segundo, sem depender do backend estar no ar pra o usuário
  // conseguir nem entrar.
  let name = '';
  let saving = false;

  // Hábitos iniciais pra a tela de Hábitos não começar vazia. O usuário
  // pode apagar ou arquivar qualquer um deles depois — são só um ponto
  // de partida, não uma imposição.
  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  async function start() {
    if (!name.trim() || saving) return;
    saving = true;

    try {
      await db.player.add({
        name: name.trim(),
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      // A partir daqui, o App.svelte percebe (via liveQuery) que já existe
      // um player e troca pra tela de Início sozinho — não precisamos
      // "navegar" manualmente pra lugar nenhum.
      await db.habits.bulkAdd(
        starterHabits.map((h) => ({ ...h, archivedAt: null, createdAt: new Date().toISOString() }))
      );
    } finally {
      saving = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  <div class="w-full max-w-sm text-center flex flex-col items-center gap-5">
    <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">✨</div>

    <div>
      <h1 class="text-xl font-semibold mb-1">Bem-vindo ao LifeQuest</h1>
      <p class="text-sm text-white/60">Como podemos te chamar?</p>
    </div>

    <form on:submit|preventDefault={start} class="w-full flex flex-col gap-3">
      <input
        class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-center"
        placeholder="Seu nome"
        bind:value={name}
        autofocus
      />

      <button
        type="submit"
        class="bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40"
        disabled={!name.trim() || saving}
      >
        {saving ? 'Preparando sua jornada...' : 'Começar jornada'}
      </button>
    </form>
  </div>
</main>
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

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  const plans = liveQuery(() => db.workoutPlans.toArray());

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

mkdir -p "frontend/src/components"
cat > "frontend/src/components/StatsBar.svelte" << 'LIFEQUEST_EOF'
<script>
  import { xpToNextLevel, xpProgressPercent } from '../lib/gamification.js';

  export let level;
  export let xp;
  export let streak;

  $: progress = xpProgressPercent(level, xp);
  $: needed = xpToNextLevel(level);
</script>

<div class="bg-surface rounded-xl p-4">
  <div class="flex justify-between items-baseline mb-1">
    <span class="font-semibold">Nível {level}</span>
    <span class="text-xs text-white/50">{xp} / {needed} XP</span>
  </div>
  <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
    <div class="bg-xp h-2 rounded-full transition-all" style="width: {progress}%"></div>
  </div>
  <p class="text-[11px] text-white/40 mt-1">{progress}% até o nível {level + 1}</p>
  <p class="text-xs text-white/50 mt-2">🔥 Streak: {streak} dia{streak === 1 ? '' : 's'}</p>
</div>
LIFEQUEST_EOF

echo "Pronto. Rode: cd frontend && npm install && npm run dev"
