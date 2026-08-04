<script>
  import { onMount } from 'svelte';
  import { db } from '../db/db.js';
  import { nav, navigate } from '../lib/nav.js';

  let totalXP = 0;
  let totalCoins = 0;
  let totalHabits = 0;
  let completedHabits = 0;
  let totalGoals = 0;
  let achievedGoals = 0;
  let totalWorkouts = 0;
  let streak = 0;

  onMount(async () => {
    const player = await db.player.toCollection().first();
    if (player) {
      totalXP = player.xp || 0;
      totalCoins = player.coins || 0;
      streak = player.streak || 0;
    }

    const habits = await db.habits.toArray();
    totalHabits = habits.length;
    const comps = await db.habitCompletions.toArray();
    completedHabits = comps.length;

    const goals = await db.goals.toArray();
    totalGoals = goals.length;
    achievedGoals = goals.filter(g => !!g.achievedAt).length;

    totalWorkouts = await db.workoutPlans.count();
  });

  $: habitCompletionRate = totalHabits > 0 ? Math.round((completedHabits / (completedHabits + totalHabits)) * 100) : 0;
  $: goalCompletionRate = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto flex flex-col text-white">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6 mt-4">
    <button class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-colors" on:click={() => navigate('dashboard')}>
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <div class="text-center flex-1 pr-10">
      <h1 class="text-xl font-black tracking-tight">Estatísticas</h1>
      <p class="text-[11px] text-white/40">Sua performance global</p>
    </div>
  </div>

  <!-- Principais -->
  <div class="grid grid-cols-2 gap-3 mb-4">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-4 flex flex-col items-center text-center">
      <svg class="w-6 h-6 text-yellow-500 mb-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      <h3 class="text-2xl font-black">{totalXP}</h3>
      <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">XP Acumulado</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-4 flex flex-col items-center text-center">
      <svg class="w-6 h-6 text-orange-500 mb-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12,22A10,10,0,0,1,2.83,16c.45-.48.91-1,1.4-1.42A7,7,0,0,0,10,21.57c0-2.31-1.31-3.64-2.8-5.2C5.58,14.65,4,13,4,9.5A8,8,0,0,1,12,2a5,5,0,0,0,1,5c0,1-1,2-1,3,1.69-1.07,4-2,5-4a6.52,6.52,0,0,1,1,3.46c0,4-2.58,6-5,7a4.42,4.42,0,0,0,2.15-1.5,10,10,0,0,1-2.15,3Z"/></svg>
      <h3 class="text-2xl font-black">{streak}</h3>
      <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Dias Seguidos</span>
    </div>
  </div>

  <!-- Progresso Bars -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 mb-4">
    <h3 class="text-[13px] font-bold mb-4">Taxas de Conclusão</h3>
    
    <div class="mb-4">
      <div class="flex justify-between items-end mb-1.5">
        <span class="text-[11px] font-medium text-white/70">Hábitos Diários</span>
        <span class="text-[12px] font-black text-blue-400">{habitCompletionRate}%</span>
      </div>
      <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-blue-500 rounded-full transition-all duration-1000" style="width: {habitCompletionRate}%;"></div>
      </div>
    </div>

    <div>
      <div class="flex justify-between items-end mb-1.5">
        <span class="text-[11px] font-medium text-white/70">Metas de Vida</span>
        <span class="text-[12px] font-black text-emerald-400">{goalCompletionRate}%</span>
      </div>
      <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-500 rounded-full transition-all duration-1000" style="width: {goalCompletionRate}%;"></div>
      </div>
    </div>
  </div>

  <!-- Outros Numeros -->
  <div class="grid grid-cols-3 gap-2">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 text-center">
      <span class="block text-lg font-black text-white">{completedHabits}</span>
      <span class="text-[9px] text-white/40 uppercase tracking-wide">Hábitos Concl.</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 text-center">
      <span class="block text-lg font-black text-white">{achievedGoals}</span>
      <span class="text-[9px] text-white/40 uppercase tracking-wide">Metas Concl.</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 text-center">
      <span class="block text-lg font-black text-white">{totalWorkouts}</span>
      <span class="text-[9px] text-white/40 uppercase tracking-wide">Treinos</span>
    </div>
  </div>
</main>
