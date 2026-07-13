<script>
  import { createEventDispatcher } from 'svelte';
  import { goalProgressPercent, daysUntilDeadline } from '../lib/goals.js';

  export let goal;

  const dispatch = createEventDispatcher();

  $: progress = goalProgressPercent(goal);
  $: achieved = !!goal.achievedAt;
  $: daysLeft = daysUntilDeadline(goal.deadline);

  let increment = 1;
</script>

<div class="bg-surface rounded-xl p-4 {achieved ? 'opacity-60' : ''}">
  <div class="flex justify-between items-start gap-2 mb-1">
    <h3 class="font-semibold text-sm {achieved ? 'line-through' : ''}">{goal.title}</h3>
    <span class="shrink-0 text-xs text-xp">+{goal.xpReward} XP</span>
  </div>

  {#if goal.reward}
    <p class="text-xs text-white/40 mb-2">🎁 {goal.reward}</p>
  {/if}

  {#if achieved}
    <p class="text-xs text-primary">✅ Meta alcançada — recompensa desbloqueada</p>
  {:else}
    <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-1">
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
          class="bg-primary text-white rounded-lg px-2 py-1 text-xs font-medium"
          on:click={() => dispatch('progress', { goal, amount: Number(increment) || 0 })}
        >
          +
        </button>
      </div>
    </div>
  {/if}
</div>
