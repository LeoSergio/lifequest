<script>
  export let days = []; // [{ label, trained, isToday }]
  export let streak = 0;
</script>

<div class="bg-surface/80 border border-white/5 rounded-2xl p-4">
  <div class="flex justify-between items-center mb-4">
    <div class="flex items-center gap-1.5">
      <span class="text-lg">🔥</span>
      <span class="font-bold text-white text-sm">{streak} dias de ofensiva</span>
      <span class="text-white/30 text-[10px] cursor-pointer hover:text-white/50 border border-white/20 rounded-full w-3.5 h-3.5 flex items-center justify-center ml-0.5">i</span>
    </div>
    <button class="flex items-center gap-1 text-[10px] text-white/50 border border-white/10 rounded-full px-2.5 py-1 hover:bg-white/5 transition-colors">
      Entenda <span>›</span>
    </button>
  </div>

  <div class="flex justify-between px-2">
    {#each days as day}
      <div class="flex flex-col items-center gap-2">
        <span class="text-[10px] text-white/40 font-medium uppercase">{day.label[0]}</span>
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center transition-all
            {day.trained ? 'bg-bg shadow-[0_0_10px_rgba(124,92,255,0.4)]' : 'bg-white/5'}
            {day.isToday ? 'border-dashed border-2 border-primary bg-transparent' : 'border border-transparent'}"
        >
        </div>
      </div>
    {/each}
  </div>
  
  <p class="text-[11px] text-white/40 mt-4 text-left px-1">Complete seus treinos e quebre a inércia.</p>
</div>
