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
