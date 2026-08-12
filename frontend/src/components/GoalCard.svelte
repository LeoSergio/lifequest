<script>
  import { createEventDispatcher } from 'svelte';
  import { goalProgressPercent, daysUntilDeadline } from '../lib/goals.js';

  export let goal;

  const dispatch = createEventDispatcher();

  $: progress = goalProgressPercent(goal);
  $: achieved = !!goal.achievedAt;
  $: daysLeft = daysUntilDeadline(goal.deadline);

  let increment = 1;
  let processing = false;

  $: timeProgress = (() => {
    if (!goal.deadline || !goal.createdAt) return 0;
    const start = new Date(goal.createdAt).getTime();
    const end = new Date(goal.deadline + 'T23:59:59').getTime();
    const now = new Date().getTime();
    
    if (now >= end) return 100;
    if (now <= start) return 0;
    
    const total = end - start;
    const elapsed = now - start;
    return Math.round((elapsed / total) * 100);
  })();

  async function handleConclude() {
    if (processing) return;
    processing = true;
    dispatch('progress', { goal, amount: 1 });
    // Reset após um tempo para caso a UI não atualize (ex: meta já concluída)
    setTimeout(() => { processing = false; }, 2000);
  }

  async function handleIncrement() {
    if (processing) return;
    processing = true;
    dispatch('progress', { goal, amount: Number(increment) || 0 });
    setTimeout(() => { processing = false; }, 2000);
  }
</script>

<div class="bg-surface rounded-xl p-4 {achieved ? 'opacity-60' : ''} group relative">
  <div class="flex justify-between items-start gap-2 mb-1">
    <h3 class="font-semibold text-sm {achieved ? 'line-through' : ''}">{goal.title}</h3>
    <div class="flex items-center gap-2">
      <span class="shrink-0 text-xs text-xp">+{goal.xpReward} XP</span>
      <button 
        class="text-white/20 hover:text-red-400 transition-colors"
        title="Excluir Meta"
        on:click={() => dispatch('delete', goal.id)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </button>
    </div>
  </div>

  {#if goal.reward}
    <p class="text-xs text-white/40 mb-2">🎁 {goal.reward}</p>
  {/if}

  {#if achieved}
    <p class="text-[11px] font-bold text-green-400 mt-2">✅ Meta alcançada — recompensa desbloqueada</p>
  {:else}
    {#if goal.targetValue === 1}
      <!-- UI Simplificada para metas de tarefa única -->
      {#if daysLeft !== null}
        <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-2 mt-3">
          <div class="h-1.5 rounded-full transition-all {timeProgress > 80 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'}" style="width: {timeProgress}%"></div>
        </div>
      {/if}
      <div class="flex justify-between items-center mt-1">
        {#if daysLeft !== null}
          <p class="text-[10px] {daysLeft < 0 ? 'text-red-400 font-bold' : daysLeft <= 2 ? 'text-orange-400' : 'text-white/40'}">
            {daysLeft >= 0 ? `${daysLeft}d restantes` : 'prazo vencido'}
          </p>
        {:else}
          <div></div>
        {/if}
        <button
          class="bg-[#9333EA] text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-[#a855f7] transition-colors shadow-[0_0_10px_rgba(147,51,234,0.3)] disabled:opacity-50 flex items-center gap-1.5"
          on:click={handleConclude}
          disabled={processing}
        >
          {#if processing}
            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          {:else}
            ✓
          {/if}
          Concluir Meta
        </button>
      </div>
    {:else}
      <!-- UI Original para metas com progresso numérico (legado) -->
      <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-1 mt-2">
        <div class="bg-primary h-1.5 rounded-full transition-all" style="width: {progress}%"></div>
      </div>
      <div class="flex justify-between items-center">
        <p class="text-[11px] text-white/40">
          {goal.currentValue}{goal.unit ?? ''} / {goal.targetValue}{goal.unit ?? ''}
          {#if daysLeft !== null}
            · {daysLeft >= 0 ? `${daysLeft}d restantes` : 'prazo vencido'}
          {/if}
        </p>

        <div class="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min="0"
            class="w-14 bg-bg border border-white/10 rounded px-1 py-1 text-xs text-center"
            bind:value={increment}
          />
          <button
            class="bg-primary text-white rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 flex items-center gap-1"
            on:click={handleIncrement}
            disabled={processing}
          >
            {#if processing}
              <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {:else}
              +
            {/if}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
