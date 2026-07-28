<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import ShopList from '../components/ShopList.svelte';

  const player = liveQuery(() => db.player.toCollection().first());
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto flex flex-col gap-6">
  
  <!-- Header Loja -->
  <div class="px-2 mt-4 mb-2">
    <div class="flex justify-between items-start mb-2">
      <div>
        <h1 class="text-3xl font-black text-white tracking-tight mb-1">Loja</h1>
        <p class="text-[13px] text-white/50 max-w-[200px] leading-snug">Troque moedas por vantagens e cosméticos.</p>
      </div>
      <div class="bg-[#1C1C22]/80 border border-white/5 px-4 py-2 rounded-[20px] flex items-center gap-2 shadow-inner mt-1">
        <div class="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
        <span class="font-bold text-yellow-500 text-[13px]">{$player?.coins || 0}</span>
      </div>
    </div>
  </div>

  <ShopList />

</main>
