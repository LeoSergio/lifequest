<script>
  import { createEventDispatcher } from 'svelte';

  export let mission;

  const dispatch = createEventDispatcher();

  const pillarLabel = {
    lar: '🏠 Lar',
    academia: '💪 Academia',
    disciplina: '📅 Disciplina',
    social: '🤝 Social'
  };
</script>

<div class="bg-surface rounded-xl p-4 flex justify-between items-center gap-3">
  <div>
    <span class="text-xs text-white/40">{pillarLabel[mission.pillar] ?? mission.pillar}</span>
    <h3 class="font-semibold">{mission.title}</h3>
    <p class="text-sm text-white/60">{mission.description}</p>
    <p class="text-xs text-xp mt-1">+{mission.xpReward} XP</p>
  </div>

  {#if mission.status === 'pending'}
    <button
      class="shrink-0 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium"
      on:click={() => dispatch('complete', mission)}
    >
      Concluir
    </button>
  {:else}
    <span class="shrink-0 text-xs text-white/40">✅ feita</span>
  {/if}
</div>
