<script>
  import Habits from './Habits.svelte';
  import Goals from './Goals.svelte';

  let topTab = 'habits'; // 'habits' | 'goals'
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto relative">
  <div class="flex bg-surface rounded-xl p-1 mb-6 text-sm max-w-xs mx-auto border border-white/5">
    <button
      class="flex-1 py-2.5 rounded-lg font-medium transition-all {topTab === 'habits' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/70'}"
      on:click={() => (topTab = 'habits')}
    >
      Hábitos
    </button>
    <button
      class="flex-1 py-2.5 rounded-lg font-medium transition-all {topTab === 'goals' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/70'}"
      on:click={() => (topTab = 'goals')}
    >
      Metas
    </button>
  </div>

  {#if topTab === 'habits'}
    <Habits />
  {:else}
    <Goals />
  {/if}
</main>
