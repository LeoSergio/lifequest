<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import { completedToday, todayIso } from '../lib/habits.js';
  import { navigate } from '../lib/nav.js';
  import { onMount } from 'svelte';

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
        await db.player.update(p.id, {
          streak: newStreak,
          lastActiveAt: today
        });
      }
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
     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5">
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Estatísticas detalhadas</h4>
              <p class="text-[10px] text-white/40">Acompanhe seu desempenho completo</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5">
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Histórico de atividades</h4>
              <p class="text-[10px] text-white/40">Veja tudo o que você já fez</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('habits')}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Hábitos</h4>
              <p class="text-[10px] text-white/40">Gerencie seus hábitos diários</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('training')}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Metas</h4>
              <p class="text-[10px] text-white/40">Acompanhe suas metas de longo prazo</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('shop')}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Personalização</h4>
              <p class="text-[10px] text-white/40">Avatar, temas e loja</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors" on:click={() => navigate('pantry')}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2zM21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Nutrição com IA</h4>
              <p class="text-[10px] text-white/40">Gerencie sua dispensa e dietas</p>
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

    <!-- Horário mais produtivo -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-3 flex flex-col justify-between">
       <div>
         <div class="flex items-center gap-1.5 mb-2">
            <svg class="w-3.5 h-3.5 text-[#a855f7] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="text-[10px] font-bold text-white leading-tight">Horário</span>
         </div>
         <h4 class="text-xl font-black text-white">Manhã</h4>
       </div>
       <p class="text-[8px] text-white/40 leading-tight mt-3">Mais produtivo entre 08:00 e 12:00</p>
    </div>

    <!-- Conquistas Recentes -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-3 flex flex-col justify-between">
       <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5">
             <svg class="w-3.5 h-3.5 text-[#a855f7] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
             <span class="text-[10px] font-bold text-white leading-tight">Conquistas</span>
          </div>
          <span class="text-[9px] text-[#a855f7] font-medium cursor-pointer shrink-0 ml-1">Ver</span>
       </div>
       <div class="flex items-start gap-1.5">
          <svg class="w-5 h-5 text-white/20 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <p class="text-[8px] text-white/40 leading-tight">Nenhuma ainda. Complete desafios!</p>
       </div>
    </div>

    <!-- Ranking Global -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-3 flex flex-col justify-between">
       <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5">
             <svg class="w-3.5 h-3.5 text-[#a855f7] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20"/><path d="M6 18v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path d="M12 12v6"/><path d="M8 12V8a4 4 0 0 1 8 0v4"/><circle cx="12" cy="8" r="4"/></svg>
             <span class="text-[10px] font-bold text-white leading-tight">Ranking</span>
          </div>
          <span class="text-[9px] text-[#a855f7] font-medium cursor-pointer shrink-0 ml-1">Ver</span>
       </div>
       <div class="flex items-end justify-between gap-1.5 mt-auto">
          <p class="text-[8px] text-white/40 leading-tight">Veja sua posição!</p>
          <div class="flex items-end gap-[1px] opacity-40 shrink-0 pb-0.5">
             <div class="w-[7px] h-[10px] bg-white/20 border border-white/30 rounded-t-[1px] flex items-center justify-center text-[4.5px]">2</div>
             <div class="w-[7px] h-[14px] bg-white/20 border border-white/30 rounded-t-[1px] flex items-center justify-center text-[4.5px]">1</div>
             <div class="w-[7px] h-[7px] bg-white/20 border border-white/30 rounded-t-[1px] flex items-center justify-center text-[4.5px]">3</div>
          </div>
       </div>
    </div>
  </div>

</main>
