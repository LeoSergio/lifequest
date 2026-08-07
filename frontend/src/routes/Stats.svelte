<script>
  import { onMount } from 'svelte';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';

  let totalXP = 0;
  let totalCoins = 0;
  let totalHabits = 0;
  let completedHabits = 0;
  let totalGoals = 0;
  let achievedGoals = 0;
  let streak = 0;
  let level = 1;

  // Treino
  let totalWorkoutPlans = 0;
  let totalSessions = 0;
  let finishedSessions = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalWeightKg = 0;
  let avgSessionMinutes = 0;
  let uniqueExercises = 0;
  let trainedThisWeek = 0;

  onMount(async () => {
    const player = await db.player.toCollection().first();
    if (player) {
      totalXP    = player.xp     || 0;
      totalCoins = player.coins  || 0;
      streak     = player.streak || 0;
      level      = player.level  || 1;
    }

    const habits = await db.habits.toArray();
    totalHabits = habits.length;
    const comps = await db.habitCompletions.toArray();
    completedHabits = comps.length;

    const goals = await db.goals.toArray();
    totalGoals    = goals.length;
    achievedGoals = goals.filter(g => !!g.achievedAt).length;

    totalWorkoutPlans = await db.workoutPlans.count();

    const sessions = await db.workoutSessions.toArray();
    totalSessions   = sessions.length;
    finishedSessions = sessions.filter(s => !!s.finishedAt && !s.isRestDay).length;

    // Tempo médio de sessão (em min)
    const durations = sessions
      .filter(s => s.startedAt && s.finishedAt)
      .map(s => (new Date(s.finishedAt) - new Date(s.startedAt)) / 60000);
    avgSessionMinutes = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Sessões nesta semana (seg–dom)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=dom
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // segunda
    startOfWeek.setHours(0, 0, 0, 0);
    const startIso = startOfWeek.toISOString().slice(0, 10);
    trainedThisWeek = sessions.filter(s => s.finishedAt && !s.isRestDay && s.finishedAt.slice(0, 10) >= startIso).length;

    // Sets / reps / carga
    const sets = await db.sessionSets.toArray();
    totalSets      = sets.length;
    totalReps      = sets.reduce((acc, s) => acc + (s.repsDone || 0), 0);
    totalWeightKg  = sets.reduce((acc, s) => acc + ((s.weightKg || 0) * (s.repsDone || 0)), 0);

    // Exercícios únicos
    const exIds = new Set(sets.map(s => s.exerciseId).filter(Boolean));
    uniqueExercises = exIds.size;
  });

  $: habitCompletionRate = totalHabits > 0
    ? Math.round((completedHabits / (completedHabits + totalHabits)) * 100)
    : 0;
  $: goalCompletionRate = totalGoals > 0
    ? Math.round((achievedGoals / totalGoals) * 100)
    : 0;

  function fmtTonnage(kg) {
    if (kg >= 1000) return `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton`;
    return `${Math.round(kg).toLocaleString('pt-BR')} kg`;
  }
</script>

<main class="min-h-screen p-4 pb-28 max-w-md mx-auto flex flex-col text-white">

  <!-- Header -->
  <div class="flex items-center gap-3 mb-7 mt-4">
    <button
      class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-colors shrink-0"
      on:click={() => navigate('dashboard')}
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <div>
      <h1 class="text-xl font-black tracking-tight">Estatísticas</h1>
      <p class="text-[11px] text-white/40">Sua performance global</p>
    </div>
  </div>

  <!-- ── HERO: XP + Streak ── -->
  <div class="grid grid-cols-2 gap-3 mb-4">
    <div class="bg-[#1C1C22]/80 border border-yellow-500/20 rounded-[22px] p-4 flex flex-col items-center text-center shadow-[0_0_20px_rgba(234,179,8,0.08)] relative overflow-hidden">
      <div class="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 blur-2xl rounded-full pointer-events-none"></div>
      <svg class="w-6 h-6 text-yellow-500 mb-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      <h3 class="text-2xl font-black">{totalXP.toLocaleString('pt-BR')}</h3>
      <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">XP Acumulado</span>
      <span class="text-[10px] text-yellow-500/70 mt-1 font-bold">Nível {level}</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-orange-500/20 rounded-[22px] p-4 flex flex-col items-center text-center shadow-[0_0_20px_rgba(249,115,22,0.08)] relative overflow-hidden">
      <div class="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 blur-2xl rounded-full pointer-events-none"></div>
      <svg class="w-6 h-6 text-orange-500 mb-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12,22A10,10,0,0,1,2.83,16c.45-.48.91-1,1.4-1.42A7,7,0,0,0,10,21.57c0-2.31-1.31-3.64-2.8-5.2C5.58,14.65,4,13,4,9.5A8,8,0,0,1,12,2a5,5,0,0,0,1,5c0,1-1,2-1,3,1.69-1.07,4-2,5-4a6.52,6.52,0,0,1,1,3.46c0,4-2.58,6-5,7a4.42,4.42,0,0,0,2.15-1.5,10,10,0,0,1-2.15,3Z"/></svg>
      <h3 class="text-2xl font-black">{streak}</h3>
      <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Dias Seguidos</span>
      <span class="text-[10px] text-orange-500/70 mt-1 font-bold">{totalCoins.toLocaleString('pt-BR')} LifeCoins</span>
    </div>
  </div>

  <!-- ── TREINO ── -->
  <div class="bg-[#1C1C22]/80 border border-purple-500/15 rounded-[24px] p-5 mb-4 relative overflow-hidden">
    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/8 blur-3xl rounded-full pointer-events-none"></div>

    <div class="flex items-center gap-2 mb-4">
      <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14"/><path d="M18 5v14"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 12h12"/></svg>
      <h3 class="text-[13px] font-bold text-white">Academia</h3>
    </div>

    <!-- Stats grid 2×2 -->
    <div class="grid grid-cols-2 gap-2.5 mb-3">
      <div class="bg-black/20 rounded-[14px] p-3 flex flex-col">
        <span class="text-[20px] font-black text-white">{finishedSessions}</span>
        <span class="text-[9px] text-white/40 uppercase tracking-wide font-bold mt-0.5">Treinos Feitos</span>
      </div>
      <div class="bg-black/20 rounded-[14px] p-3 flex flex-col">
        <span class="text-[20px] font-black text-purple-400">{trainedThisWeek}</span>
        <span class="text-[9px] text-white/40 uppercase tracking-wide font-bold mt-0.5">Nesta Semana</span>
      </div>
      <div class="bg-black/20 rounded-[14px] p-3 flex flex-col">
        <span class="text-[20px] font-black text-white">{totalSets.toLocaleString('pt-BR')}</span>
        <span class="text-[9px] text-white/40 uppercase tracking-wide font-bold mt-0.5">Séries Totais</span>
      </div>
      <div class="bg-black/20 rounded-[14px] p-3 flex flex-col">
        <span class="text-[20px] font-black text-white">{totalReps.toLocaleString('pt-BR')}</span>
        <span class="text-[9px] text-white/40 uppercase tracking-wide font-bold mt-0.5">Repetições</span>
      </div>
    </div>

    <!-- Carga total + Tempo médio + Exercícios (row) -->
    <div class="grid grid-cols-3 gap-2">
      <div class="bg-black/20 rounded-[12px] p-2.5 text-center">
        <span class="block text-[13px] font-black text-yellow-400">{fmtTonnage(totalWeightKg)}</span>
        <span class="text-[8px] text-white/40 uppercase tracking-wide">Carga Total</span>
      </div>
      <div class="bg-black/20 rounded-[12px] p-2.5 text-center">
        <span class="block text-[13px] font-black text-sky-400">{avgSessionMinutes}min</span>
        <span class="text-[8px] text-white/40 uppercase tracking-wide">Tempo Médio</span>
      </div>
      <div class="bg-black/20 rounded-[12px] p-2.5 text-center">
        <span class="block text-[13px] font-black text-emerald-400">{uniqueExercises}</span>
        <span class="text-[8px] text-white/40 uppercase tracking-wide">Exercícios</span>
      </div>
    </div>

    <!-- Fichas de treino -->
    <div class="mt-3 flex items-center justify-between bg-white/5 rounded-[12px] px-3 py-2 border border-white/5">
      <span class="text-[11px] text-white/60">Fichas de treino</span>
      <span class="text-[12px] font-black text-white">{totalWorkoutPlans}</span>
    </div>
  </div>

  <!-- ── TAXAS DE CONCLUSÃO ── -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 mb-4">
    <h3 class="text-[13px] font-bold mb-4">Taxas de Conclusão</h3>

    <div class="mb-4">
      <div class="flex justify-between items-end mb-1.5">
        <span class="text-[11px] font-medium text-white/70">Hábitos Diários</span>
        <span class="text-[12px] font-black text-blue-400">{habitCompletionRate}%</span>
      </div>
      <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_6px_rgba(59,130,246,0.5)]" style="width: {habitCompletionRate}%;"></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-[9px] text-white/30">{completedHabits} concluídos</span>
        <span class="text-[9px] text-white/30">{totalHabits} hábitos</span>
      </div>
    </div>

    <div>
      <div class="flex justify-between items-end mb-1.5">
        <span class="text-[11px] font-medium text-white/70">Metas de Vida</span>
        <span class="text-[12px] font-black text-emerald-400">{goalCompletionRate}%</span>
      </div>
      <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_6px_rgba(16,185,129,0.5)]" style="width: {goalCompletionRate}%;"></div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-[9px] text-white/30">{achievedGoals} alcançadas</span>
        <span class="text-[9px] text-white/30">{totalGoals} metas</span>
      </div>
    </div>
  </div>

  <!-- ── OUTROS NÚMEROS ── -->
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
      <span class="block text-lg font-black text-white">{totalCoins}</span>
      <span class="text-[9px] text-white/40 uppercase tracking-wide">LifeCoins</span>
    </div>
  </div>

</main>
