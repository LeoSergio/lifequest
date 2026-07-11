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
