<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import { completedToday, todayIso } from '../lib/habits.js';
  import { navigate } from '../lib/nav.js';
  import { onMount } from 'svelte';
  import { pushSync } from '../services/syncService.js';
  import { fetchGlobalRanking } from '../services/socialService.js';

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());

  $: streak = $player?.streak || 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];

  $: totalXp = $player?.xp ?? 0;
  $: currentLevel = $player?.level ?? 1;
  $: nextLevelXp = currentLevel * 100;
  $: progressPercent = Math.min(100, Math.round((totalXp / nextLevelXp) * 100));

  import { updatePlayer } from '../repositories/playerRepository.js';

  onMount(async () => {
    const p = await db.player.toCollection().first();
    if (p) {
      const today = todayIso();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().slice(0, 10);

      let newStreak = p.streak || 0;
      let lastActive = p.lastActiveAt;

      if (lastActive !== today) {
        if (lastActive === yesterday) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        await updatePlayer(p.id, {
          streak: newStreak,
          lastActiveAt: today
        });
        // Push imediato: streak atualizado vai para a nuvem agora
        pushSync().catch(() => {});
      }
    }
  });

  onMount(async () => {
    try {
      const data = await fetchGlobalRanking();
      rankingTop3 = data.slice(0, 3);
      myRankEntry = data.find(r => r.is_me) ?? null;
    } catch (e) {
      console.warn('[Dashboard] Ranking indisponível:', e);
    } finally {
      rankingLoading = false;
    }
  });

  // Calculate some stats
  $: habitsCompleted = $completions?.length || 0;
  $: workoutsCompleted = $sessions?.length || 0;

  // Helpers for timeline
  const timelineNodes = [
    { level: 2, title: 'Iniciante', xp: null, active: true },
    { level: 3, title: 'Aprendiz', xp: '200 XP', active: false },
    { level: 4, title: 'Guerreiro', xp: '450 XP', active: false },
    { level: 5, title: 'Guardião', xp: '800 XP', active: false }
  ];

  // Ranking snapshot
  let rankingTop3 = [];
  let myRankEntry = null;
  let rankingLoading = true;

  function xpShort(xp) {
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`;
    return String(xp);
  }
</script>

<style>
  .clip-hex {
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  }
</style>

<main class="min-h-screen p-4 pb-24 flex flex-col max-w-md mx-auto">
  
  {#if $player}
    <!-- Top Hero Card -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 relative overflow-hidden shadow-inner mt-2">
      <!-- Avatar and Info row -->
      <div class="flex justify-between items-start mb-6">
        <div class="flex items-center gap-4">
          <div class="relative shrink-0">
            <div class="w-[72px] h-[72px] rounded-full border-[2px] border-[#9333EA] shadow-[0_0_20px_rgba(147,51,234,0.4)] overflow-hidden bg-surface flex items-center justify-center text-3xl">
              {#if $player?.avatar}
                 {#if $player.avatar.startsWith('data:image')}
                   <img src={$player.avatar} alt="Avatar" class="w-full h-full object-cover" />
                 {:else}
                   <span>{$player.avatar}</span>
                 {/if}
              {:else}
                 <span>👤</span>
              {/if}
            </div>
            <button class="absolute bottom-0 right-0 bg-[#1C1C22] text-white/70 w-7 h-7 rounded-full flex items-center justify-center border border-white/10 hover:text-white transition-colors" on:click={() => navigate('profile')}>
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          </div>
          <div>
            <h2 class="text-white text-[19px] font-bold mb-1 leading-tight">{$player.name || 'Herói'}</h2>
            <div class="flex items-center gap-1.5 mb-2">
              <span class="bg-[#9333EA]/20 text-[#c084fc] border border-[#a855f7]/30 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1.5">
                <svg class="w-3 h-3 text-[#c084fc]" viewBox="0 0 24 24" fill="currentColor"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM4 18h16v2H4z"/></svg> Iniciante
              </span>
            </div>
            <p class="text-[10px] text-white/50 italic">"Disciplina hoje, liberdade amanhã."</p>
          </div>
        </div>
        
        <!-- Level Badge -->
        <div class="shrink-0 flex items-start pt-1">
           <div class="relative w-[54px] h-[62px] flex flex-col items-center justify-center">
              <svg class="absolute inset-0 w-full h-full text-[#1C1C22] drop-shadow-[0_0_15px_rgba(147,51,234,0.3)]" viewBox="0 0 100 115" fill="currentColor" stroke="#9333EA" stroke-width="2.5">
                 <polygon points="50,2.5 97.5,30 97.5,85 50,112.5 2.5,85 2.5,30" />
              </svg>
              <!-- Decorative leaves -->
              <svg class="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 text-[#5b21b6] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M20 2C15 2 10 5 8 10C8 10 13 12 16 8C19 4 20 2 20 2Z"/><path d="M20 2C20 7 17 12 12 14C12 14 10 9 14 6C18 3 20 2 20 2Z"/><path d="M12 14L4 22"/></svg>
              <svg class="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 text-[#5b21b6] opacity-70 scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M20 2C15 2 10 5 8 10C8 10 13 12 16 8C19 4 20 2 20 2Z"/><path d="M20 2C20 7 17 12 12 14C12 14 10 9 14 6C18 3 20 2 20 2Z"/><path d="M12 14L4 22"/></svg>
              
              <span class="relative z-10 text-[7.5px] text-white/80 font-black uppercase tracking-widest mt-1">Nível</span>
              <span class="relative z-10 text-[24px] font-black text-white leading-none mt-0.5">{currentLevel}</span>
           </div>
        </div>
      </div>

      <!-- Progress row -->
      <div class="grid grid-cols-12 gap-3 items-center">
         <div class="col-span-6 flex flex-col justify-center">
            <div class="flex justify-between items-end mb-1.5">
               <span class="text-[10px] text-white/80 font-medium">Seu progresso</span>
               <span class="text-[9px] text-white/50"><span class="text-[#a855f7] font-bold">{totalXp}</span> / {nextLevelXp} XP</span>
            </div>
            <div class="w-full h-[5px] bg-white/10 rounded-full mb-1.5 overflow-hidden">
               <div class="h-full bg-gradient-to-r from-[#9333EA] to-[#c084fc] rounded-full" style="width: {progressPercent}%"></div>
            </div>
            <span class="text-[9px] text-white/40"><span class="text-[#a855f7] font-bold">{progressPercent}%</span> até o nível {currentLevel + 1}</span>
         </div>
         
         <div class="col-span-3 flex flex-col items-center justify-center border-l border-white/5 h-full pt-1">
            <svg class="w-5 h-5 text-orange-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" viewBox="0 0 24 24" fill="currentColor"><path d="M12,22A10,10,0,0,1,2.83,16c.45-.48.91-1,1.4-1.42A7,7,0,0,0,10,21.57c0-2.31-1.31-3.64-2.8-5.2C5.58,14.65,4,13,4,9.5A8,8,0,0,1,12,2a5,5,0,0,0,1,5c0,1-1,2-1,3,1.69-1.07,4-2,5-4a6.52,6.52,0,0,1,1,3.46c0,4-2.58,6-5,7a4.42,4.42,0,0,0,2.15-1.5,10,10,0,0,1-2.15,3Z"/></svg>
            <span class="text-[9px] text-white/50 mt-1">Streak</span>
            <span class="text-[10px] font-bold text-white leading-tight">{streak} dia</span>
         </div>

         <div class="col-span-3 flex flex-col items-center justify-center border-l border-white/5 h-full pt-1">
            <svg class="w-4 h-4 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] mb-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8C10.35 6 9 7.35 9 9s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zM7 21v-2c0-1.66 1.34-3 3-3h4c1.66 0 3 1.34 3 3v2H7z"/></svg>
            <span class="text-[9px] text-white/50">Moedas</span>
            <span class="text-[10px] font-bold text-yellow-500 leading-tight">{$player.coins || 0}</span>
         </div>
      </div>
    </div>
  {/if}

  <!-- Stats Grid -->
  <div class="grid grid-cols-4 gap-2 mt-4">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-[#a855f7] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">0</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Missões</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-green-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{habitsCompleted}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Hábitos</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-yellow-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">0</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Conquistas</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-blue-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{totalXp}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">XP Total</span>
    </div>
  </div>

  <!-- Sua Jornada -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 mt-4">
    <h3 class="text-[13px] font-bold text-white mb-6">Sua Jornada</h3>
    <div class="flex justify-between items-center relative px-1">
       <!-- dashed line -->
       <div class="absolute top-[18px] left-[10%] right-[15%] h-[1px] border-t border-dashed border-white/20 z-0"></div>
       <div class="absolute top-[18px] left-[10%] w-1/4 h-[1px] border-t border-dashed border-[#a855f7] z-0"></div>
       
       {#each timelineNodes as node}
         <div class="relative z-10 flex flex-col items-center gap-1.5 w-14">
            {#if node.active}
               <div class="w-9 h-10 flex items-center justify-center clip-hex bg-[#9333EA] text-white text-[13px] font-bold shadow-[0_0_15px_rgba(147,51,234,0.5)]">
                 {node.level}
               </div>
               <span class="text-[9px] text-white font-medium">{node.title}</span>
            {:else}
               <div class="w-9 h-10 flex items-center justify-center clip-hex bg-[#1C1C22] text-white/40 border border-white/10 text-[13px] font-bold">
                 {node.level}
               </div>
               <div class="flex flex-col items-center">
                  <span class="text-[9px] text-white/40">{node.title}</span>
                  {#if node.xp}<span class="text-[8px] text-white/30">{node.xp}</span>{/if}
               </div>
            {/if}
         </div>
       {/each}
       
       <button class="relative z-10 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 text-[10px] shrink-0 hover:bg-white/10 transition-colors">
         ›
       </button>
    </div>
  </div>

  <!-- Links / Ações -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] py-2 mt-4 flex flex-col">
     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('stats')}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Estatísticas detalhadas</h4>
              <p class="text-[10px] text-white/40">Acompanhe seu desempenho completo</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('quests', { tab: 'loja' })}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12A4 4 0 0 0 8 12M12 16v.01"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Personalização</h4>
              <p class="text-[10px] text-white/40">Visite a loja para temas e avatares</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors" on:click={() => navigate('quests', { tab: 'conquistas' })}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Ver as conquistas</h4>
              <p class="text-[10px] text-white/40">Acompanhe suas medalhas e troféus</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>
  </div>

  <!-- 2x2 Grid -->
  <div class="grid grid-cols-2 gap-2 mt-4">
    <!-- Melhores Sequencias -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-3 flex flex-col justify-between">
       <div>
         <div class="flex items-center gap-1.5 mb-2">
            <svg class="w-3.5 h-3.5 text-orange-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12,22A10,10,0,0,1,2.83,16c.45-.48.91-1,1.4-1.42A7,7,0,0,0,10,21.57c0-2.31-1.31-3.64-2.8-5.2C5.58,14.65,4,13,4,9.5A8,8,0,0,1,12,2a5,5,0,0,0,1,5c0,1-1,2-1,3,1.69-1.07,4-2,5-4a6.52,6.52,0,0,1,1,3.46c0,4-2.58,6-5,7a4.42,4.42,0,0,0,2.15-1.5,10,10,0,0,1-2.15,3Z"/></svg>
            <span class="text-[10px] font-bold text-white leading-tight">Melhores seq.</span>
         </div>
         <h4 class="text-xl font-black text-white">{streak} dia</h4>
         <p class="text-[8px] text-white/40">Maior sequência</p>
       </div>
       <!-- Mini semana -->
       <div class="flex justify-between mt-3">
          {#each ['S','T','Q','Q','S','S','D'] as day, i}
             <div class="flex flex-col items-center gap-0.5">
                <div class="w-2.5 h-3.5 rounded-[2px] {i === 0 ? 'bg-[#a855f7] shadow-[0_0_5px_rgba(168,85,247,0.5)]' : 'bg-white/5'}"></div>
                <span class="text-[7px] text-white/30">{day}</span>
             </div>
          {/each}
       </div>
    </div>



    <!-- Conquistas Recentes -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-3 flex flex-col justify-between col-span-2">
       <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5">
             <svg class="w-3.5 h-3.5 text-[#a855f7] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
             <span class="text-[10px] font-bold text-white leading-tight">Conquistas</span>
          </div>
          <span class="text-[9px] text-[#a855f7] font-medium cursor-pointer shrink-0 ml-1" on:click={() => navigate('quests', { tab: 'conquistas' })}>Ver</span>
       </div>
       <div class="flex items-start gap-1.5">
          <svg class="w-5 h-5 text-white/20 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <p class="text-[8px] text-white/40 leading-tight">Nenhuma ainda. Complete desafios!</p>
       </div>
    </div>
  </div>


  <!-- ══════════════════════════════════════ -->
  <!-- 🏆 RANKING GLOBAL — Seção em Destaque -->
  <!-- ══════════════════════════════════════ -->
  <div class="mt-4 bg-gradient-to-br from-[#1C1C22]/90 to-[#1a1025]/90 border border-[#a855f7]/20 rounded-[24px] p-5 relative overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.08)]">
    <!-- Glow de fundo decorativo -->
    <div class="absolute -top-8 -right-8 w-32 h-32 bg-[#9333EA]/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="absolute -bottom-6 -left-6 w-24 h-24 bg-[#a855f7]/8 rounded-full blur-2xl pointer-events-none"></div>

    <!-- Header -->
    <div class="flex items-center justify-between mb-4 relative z-10">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-[10px] bg-[#9333EA]/20 border border-[#a855f7]/30 flex items-center justify-center">
          <svg class="w-4 h-4 text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
        </div>
        <div>
          <h3 class="text-[12px] font-bold text-white leading-none">Ranking Global</h3>
          <p class="text-[9px] text-white/40 mt-0.5">Top jogadores do LifeQuest</p>
        </div>
      </div>
      <button
        class="text-[10px] font-bold text-[#a855f7] hover:text-[#c084fc] transition-colors flex items-center gap-1"
        on:click={() => navigate('ranking')}
      >
        Ver tudo <span class="opacity-60">›</span>
      </button>
    </div>

    <!-- Top 3 -->
    {#if rankingLoading}
      <div class="flex items-center justify-center py-6 gap-3 relative z-10">
        <div class="w-4 h-4 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
        <span class="text-[11px] text-white/30">Carregando ranking...</span>
      </div>
    {:else if rankingTop3.length === 0}
      <p class="text-[11px] text-white/30 text-center py-4 relative z-10">Nenhum jogador ainda.</p>
    {:else}
      <!-- Pódio compacto -->
      <div class="flex items-end justify-center gap-2 mb-4 relative z-10">
        {#each rankingTop3 as entry, i}
          {@const medals = ['🥇','🥈','🥉']}
          {@const heights = ['h-[70px]','h-[56px]','h-[48px]']}
          {@const orders = [1, 0, 2]}
          {@const borderColors = ['border-yellow-400/60','border-slate-400/40','border-orange-700/40']}
          {@const glows = ['shadow-[0_0_12px_rgba(234,179,8,0.35)]','shadow-[0_0_8px_rgba(148,163,184,0.2)]','shadow-[0_0_8px_rgba(180,83,9,0.2)]']}

          <div
            class="flex flex-col items-center gap-1.5 flex-1"
            style="order: {orders[i]}"
          >
            <!-- Avatar -->
            <div class="relative">
              <div class="w-11 h-11 rounded-full overflow-hidden border-2 {borderColors[i]} bg-surface flex items-center justify-center text-xl {glows[i]} {entry.is_me ? 'ring-2 ring-[#a855f7] ring-offset-1 ring-offset-[#1a1025]' : ''}">
                {#if entry.avatar?.startsWith('data:image')}
                  <img src={entry.avatar} alt={entry.username} class="w-full h-full object-cover" />
                {:else}
                  <span class="text-lg">{entry.avatar || '👤'}</span>
                {/if}
              </div>
              <span class="absolute -bottom-1 -right-1 text-sm leading-none">{medals[i]}</span>
            </div>

            <!-- Nome -->
            <div class="text-center">
              <p class="text-[10px] font-bold text-white truncate max-w-[60px]">{entry.username}</p>
              <p class="text-[8px] text-white/40">Nível {entry.level}</p>
            </div>

            <!-- Barra de pódio -->
            <div class="{heights[i]} w-full rounded-t-[6px] flex items-end justify-center pb-1.5 {i === 0 ? 'bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 border border-yellow-500/20' : i === 1 ? 'bg-gradient-to-t from-slate-400/15 to-slate-400/5 border border-slate-400/15' : 'bg-gradient-to-t from-orange-700/15 to-orange-700/5 border border-orange-700/15'}">
              <span class="text-[9px] font-black {i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : 'text-orange-500'}">{xpShort(entry.xp)}</span>
            </div>
          </div>
        {/each}
      </div>

      <!-- Posição do usuário logado -->
      {#if myRankEntry}
        <div class="border-t border-white/5 pt-3 flex items-center gap-3 relative z-10">
          <span class="text-[10px] font-black text-[#a855f7] w-6 text-center">#{myRankEntry.rank}</span>
          <div class="w-7 h-7 rounded-full overflow-hidden border border-[#a855f7]/40 bg-surface flex items-center justify-center text-sm">
            {#if myRankEntry.avatar?.startsWith('data:image')}
              <img src={myRankEntry.avatar} alt="Você" class="w-full h-full object-cover" />
            {:else}
              <span>{myRankEntry.avatar || '👤'}</span>
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold text-white leading-none">Sua posição</p>
            <p class="text-[9px] text-white/40 mt-0.5">Nível {myRankEntry.level} · {xpShort(myRankEntry.xp)} XP</p>
          </div>
          <span class="text-[9px] font-bold text-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 rounded-full">Você</span>
        </div>
      {/if}
    {/if}
  </div>

</main>
