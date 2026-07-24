<script>
  import { navigate } from '../lib/nav.js';
  import NutritionList from '../components/NutritionList.svelte';
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <div class="flex items-center bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-1 mb-6 shadow-inner relative">
    <button class="flex-1 py-2 text-[11px] font-bold rounded-[12px] transition-all relative z-10 text-white/40 hover:text-white/70" on:click={() => navigate('training')}>
      Treinos
    </button>
    <button class="flex-1 py-2 text-[11px] font-bold rounded-[12px] transition-all relative z-10 bg-[#9333EA] text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]">
      Nutrição IA
    </button>
  </div>

  <NutritionList />
</main>
