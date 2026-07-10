<script>
  export let days = []; // [{ label, trained, isToday }]
  export let streak = 0;
</script>

<div class="bg-surface rounded-xl p-4">
  <div class="flex items-center gap-2 mb-3">
    <span class="text-2xl">🔥</span>
    <span class="font-semibold">{streak} dia{streak === 1 ? '' : 's'} de ofensiva</span>
  </div>

  <div class="flex justify-between">
    {#each days as day}
      <div class="flex flex-col items-center gap-1">
        <span class="text-xs text-white/40">{day.label}</span>
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors
            {day.trained ? 'bg-xp' : 'bg-white/10'}
            {day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}"
        >
          {#if day.trained}🔥{/if}
        </div>
      </div>
    {/each}
  </div>
</div>
