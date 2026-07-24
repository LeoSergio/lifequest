<script>
  import Habits from './Habits.svelte';
  import Goals from './Goals.svelte';

  let topTab = 'habits'; // 'habits' | 'goals'
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto relative">
  <div class="inline-flex gap-1.5 bg-[#1C1C22]/80 rounded-[20px] p-1.5 mb-8 border border-white/5 shadow-inner">
    <button
      class="px-6 py-2.5 rounded-[16px] font-bold text-[13px] transition-all {topTab === 'habits' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-white/50 hover:text-white/80'}"
      on:click={() => (topTab = 'habits')}
    >
      Hábitos
    </button>
    <button
      class="px-6 py-2.5 rounded-[16px] font-bold text-[13px] transition-all {topTab === 'goals' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-white/50 hover:text-white/80'}"
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
