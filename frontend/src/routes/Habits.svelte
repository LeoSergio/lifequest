<script>
  import { successRate, habitStreak } from '../lib/habits.js';
  import { allHabitsQuery, allCompletionsQuery } from '../repositories/habitRepository.js';
  import { completeHabit, addHabit, archiveHabit } from '../services/habitService.js';
  import HabitCard from '../components/HabitCard.svelte';

  const allHabits = allHabitsQuery();
  const completions = allCompletionsQuery();

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
      best = Math.max(best, habitStreak(h.id, $completions));
    }
    return best;
  })();

  async function handleComplete(event) {
    const habit = event.detail;
    const result = await completeHabit(habit, $completions ?? []);
    if (result?.leveledUp) alert(`Level up! Agora você é nível ${result.level} 🎉`);
  }

  async function createHabit() {
    if (!title.trim()) return;
    await addHabit({ title, icon, cadence, weeklyTarget });
    title = '';
    icon = '🔥';
    cadence = 'daily';
    weeklyTarget = 3;
    showForm = false;
  }

  async function handleArchive(id) {
    await archiveHabit(id);
  }
</script>

<div class="relative">
  <div class="flex justify-between items-start mb-6">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight mb-1">Hábitos</h1>
      <p class="text-[13.5px] text-white/50">Pequenos rituais, constância visível.</p>
    </div>
    <button
      class="shrink-0 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full px-4 py-2 text-xs font-bold transition-colors shadow-inner"
      on:click={() => (showForm = !showForm)}
    >
      + Novo
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

  <div class="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-6">
    {#each [['ativos', 'Ativos'], ['todos', 'Todos'], ['concluidos', 'Concluídos']] as [value, label]}
      <button
        class="px-5 py-2.5 rounded-full font-bold text-[13px] transition-all whitespace-nowrap {tab === value ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-transparent border border-white/10 text-white/50 hover:bg-white/5 hover:text-white/80'}"
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
          <HabitCard {habit} completions={$completions ?? []} on:complete={handleComplete} />
          {#if !habit.archivedAt}
            <button class="text-[10px] text-white/30 mt-1 ml-1" on:click={() => handleArchive(habit.id)}>
              marcar hábito como concluído (arquivar)
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-8 mb-4">
    <h2 class="text-[13px] font-bold text-white/80 mb-3">Estatísticas</h2>
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-[#1C1C22]/80 backdrop-blur-md border border-white/5 rounded-[20px] p-4 text-center flex flex-col justify-center shadow-inner">
        <p class="text-2xl font-black text-white">{activeHabits.length}</p>
        <p class="text-[11px] text-white/50 font-medium mt-1">Hábitos</p>
      </div>
      <div class="bg-[#1C1C22]/80 backdrop-blur-md border border-white/5 rounded-[20px] p-4 text-center flex flex-col justify-center shadow-inner">
        <p class="text-2xl font-black text-white">{bestStreak}</p>
        <p class="text-[11px] text-white/50 font-medium mt-1">Sequência</p>
      </div>
      <div class="bg-[#1C1C22]/80 backdrop-blur-md border border-white/5 rounded-[20px] p-4 text-center flex flex-col justify-center shadow-inner">
        <p class="text-2xl font-black text-white">{rate}%</p>
        <p class="text-[11px] text-white/50 font-medium mt-1">Conclusão</p>
      </div>
    </div>
  </div>
</div>
