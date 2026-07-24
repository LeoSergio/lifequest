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

<div class="bg-[#1C1C22]/80 backdrop-blur-md rounded-[28px] p-4 pr-5 border border-white/5 relative overflow-hidden flex flex-col justify-center min-h-[96px] shadow-inner transition-transform hover:bg-[#1C1C22]">
  <div class="flex items-center gap-4">
    <!-- Icon Container -->
    <div class="w-[56px] h-[56px] rounded-[20px] bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-inner relative overflow-hidden">
      <!-- Glow effect based on icon if possible, but generic works too -->
      <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
      <span class="relative z-10">{habit.icon ?? '🔥'}</span>
    </div>
    
    <!-- Info -->
    <div class="flex-1 min-w-0 flex flex-col justify-center">
      <div class="flex items-center gap-2 mb-0.5">
        <h3 class="text-[15px] font-bold text-white leading-tight truncate">{habit.title}</h3>
        {#if variant === 'full' && habit.cadence === 'daily' && streakDays > 0}
          <span class="shrink-0 text-[10px] text-xp font-black">🔥{streakDays}</span>
        {/if}
      </div>
      
      <p class="text-[11px] text-white/40 font-medium mb-2.5">
        {habit.cadence === 'weekly' ? 'Meta semanal' : 'Meta diária'}
      </p>
      
      {#if variant === 'full'}
        {#if habit.cadence === 'daily'}
          <div class="flex gap-1.5">
            {#each weekDots as day}
              <span class="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[9px] font-bold transition-all {day.done ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-white/20 border border-white/5'}">
                {day.label[0]}
              </span>
            {/each}
          </div>
        {:else}
          <div class="w-full h-[5px] bg-white/5 rounded-full overflow-hidden mb-1">
             <div class="h-full bg-[#9333EA] rounded-full transition-all" style="width: {Math.min(100, Math.round((weekCount / habit.weeklyTarget) * 100))}%"></div>
          </div>
          <p class="text-[10px] text-white/30 font-medium">{weekCount}/{habit.weeklyTarget} esta semana</p>
        {/if}
      {/if}
    </div>

    <!-- Action Button / Checkbox -->
    <div class="shrink-0 flex items-center justify-center">
      {#if habit.cadence === 'daily'}
        <button
          class="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all {done ? 'bg-white/10 border-white/20' : 'bg-transparent border border-white/10 hover:border-white/20 active:scale-95'}"
          disabled={done}
          on:click={() => dispatch('complete', habit)}
          aria-label={done ? 'Já concluído hoje' : 'Marcar como concluído hoje'}
        >
          {#if done}
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {/if}
        </button>
      {:else}
        <button
          class="bg-[#9333EA] text-black font-black px-4 py-2.5 rounded-[12px] text-[13px] shadow-[0_0_15px_rgba(147,51,234,0.3)] active:scale-95 transition-transform disabled:opacity-50"
          disabled={weekCount >= habit.weeklyTarget}
          on:click={() => dispatch('complete', habit)}
        >
          +1
        </button>
      {/if}
    </div>
  </div>
</div>
