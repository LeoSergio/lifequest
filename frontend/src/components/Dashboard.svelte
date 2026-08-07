<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp, xpToNextLevel } from '../lib/gamification.js';
  import { getTitleForLevel, isMilestoneLevel, MAX_LEVEL, generateChestReward } from '../lib/levels.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import { completedToday, todayIso } from '../lib/habits.js';
  import { navigate } from '../lib/nav.js';
  import { onMount } from 'svelte';
  import { pushSync } from '../services/syncService.js';
  import { fetchGlobalRanking } from '../services/socialService.js';
  import { updatePlayer } from '../repositories/playerRepository.js';
  import { showAlert } from '../lib/modal.js';
  import { isPro, showProBenefits } from '../lib/pro.js';

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());

  $: streak = $player?.streak || 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];
  
  // Lógica para o grid de Ofensiva (baseado na sequência atual)
  $: streakActivity = (() => {
    const dayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];
    const today = new Date();
    const days = [];
    const lastActive = $player?.lastActiveAt;
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      
      let active = false;
      if (streak > 0 && lastActive) {
        const lastDate = new Date(lastActive + 'T12:00:00');
        const targetDate = new Date(iso + 'T12:00:00');
        
        const diffTime = lastDate.getTime() - targetDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        // Se a data alvo é igual ou anterior ao lastActive, e a diferença é menor que a ofensiva
        if (diffDays >= 0 && diffDays < streak) {
          active = true;
        }
      }
      
      days.push({
        date: iso,
        label: dayLabels[d.getDay()],
        active: active,
        isToday: i === 0,
      });
    }
    return days;
  })();

  $: totalXp = $player?.xp ?? 0;
  $: currentLevel = $player?.level ?? 1;
  $: nextLevelXp = xpToNextLevel(currentLevel);
  $: progressPercent = Math.min(100, Math.round((totalXp / nextLevelXp) * 100));

  onMount(async () => {
    if (!sessionStorage.getItem('proWelcomeShown')) {
      sessionStorage.setItem('proWelcomeShown', 'true');
      showAlert({
        title: '🌟 LifeQuest PRO Chegou!',
        message: 'Acelere seus resultados com ferramentas premium:\n\n🤖 Inteligência Artificial montando seus treinos\n📊 Gráficos detalhados da sua evolução\n💰 Pro Coins mensais para usar na Loja\n🎨 Temas visuais e Avatares épicos\n\nSuba de nível de verdade com o PRO!',
        icon: '⭐',
        confirmText: 'Incrível',
        type: 'info'
      });
    }

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
  const achievementsQuery = liveQuery(() => db.unlockedAchievements.toArray());
  const dailyQuestsQuery = liveQuery(() => db.dailyQuests.toArray());

  $: habitsCompleted = $completions?.length || 0;
  $: workoutsCompleted = $sessions?.length || 0;
  $: achievementsCount = $achievementsQuery?.length || 0;
  $: missionsCount = ($dailyQuestsQuery ?? []).filter(q => q.completed).length;

  // Helpers for timeline
  let timelineOffset = 0;
  $: timelineNodes = generateTimeline(currentLevel, $player, timelineOffset);
  
  $: nextRewardLevel = getNextRewardLevel(currentLevel, $player);
  $: nextReward = generateChestReward(nextRewardLevel, isPro($player));
  
  function getNextRewardLevel(level, p) {
     let l = level + 1;
     while (l <= MAX_LEVEL) {
        if (isMilestoneLevel(l) || (p && isPro(p))) return l;
        l++;
     }
     return level;
  }

  const ICONS = [
    "M14.5 17.5L3 6m0 0l3-3 11.5 11.5M3 6l4 4M17 14l3 3-3 3-3-3 3-3z", // 0 (fallback)
    "M12 2c0 0-5 5-5 10a5 5 0 0 0 10 0c0-5-5-10-5-10zm0 13a3 3 0 0 1-3-3c0-2 3-5 3-5s3 3 3 5a3 3 0 0 1-3 3z", // 1 Fogo
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", // 2 Alvo
    "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20", // 3 Livro
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", // 4 Escudo
    "M2 4l3 11h14l3-11-5 5-5-7-5 7-5-5z" // 5 Coroa
  ];

  function generateTimeline(level, p, offset) {
    if (!level) level = 1;
    let nodes = [];
    let startLevel = level + offset;
    
    // Mostra o nível atual + 3 próximos
    // Se faltar espaço pro limite (ex: nível 66), puxa pra trás
    if (startLevel > MAX_LEVEL - 3) {
      startLevel = Math.max(1, MAX_LEVEL - 3);
    }
    if (startLevel < 1) startLevel = 1;
    
    for(let i = 0; i < 4; i++) {
      const nodeLvl = startLevel + i;
      if (nodeLvl > MAX_LEVEL) break;
      
      const titleInfo = getTitleForLevel(nodeLvl);
      
      let status = 'locked';
      if (nodeLvl < level) status = 'completed';
      if (nodeLvl === level) status = 'active';
      
      nodes.push({
        level: nodeLvl,
        title: titleInfo.title,
        color: titleInfo.color,
        xp: nodeLvl > level ? `${xpShort(xpToNextLevel(nodeLvl - 1))} XP` : null,
        status: status,
        active: nodeLvl <= level,
        hasReward: nodeLvl > level && (isMilestoneLevel(nodeLvl) || (p && isPro(p))),
        iconPath: ICONS[(nodeLvl % 5) + 1]
      });
    }
    return nodes;
  }

  function scrollTimeline(direction) {
    if (direction === 'next' && (currentLevel + timelineOffset + 3) < MAX_LEVEL) {
      timelineOffset += 3;
    } else if (direction === 'prev' && timelineOffset > 0) {
      timelineOffset -= 3;
      if (timelineOffset < 0) timelineOffset = 0;
    }
  }

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
    {#if !isPro($player)}
      <!-- Lembrete PRO -->
      <div class="bg-gradient-to-r from-[#2D1B4E] to-[#1C1C22] border border-[#a855f7]/40 rounded-[16px] p-3 mb-3 flex items-center justify-between cursor-pointer hover:border-[#a855f7] transition-colors shadow-[0_0_15px_rgba(168,85,247,0.1)] mt-2" on:click={showProBenefits}>
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          <div>
            <p class="text-[11px] font-bold text-white leading-tight">Torne-se PRO</p>
            <p class="text-[9px] text-white/50">Desbloqueie todo o potencial do LifeQuest</p>
          </div>
        </div>
        <span class="text-[10px] text-[#a855f7] font-bold">Ver mais ›</span>
      </div>
    {/if}

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
      <div class="flex items-center gap-2 w-full justify-between">
         <div class="flex-1 flex flex-col justify-center min-w-[120px] pr-2">
            <div class="flex justify-between items-end mb-1.5">
               <span class="text-[10px] text-white/80 font-medium">Seu progresso</span>
               <span class="text-[9px] text-white/50"><span class="text-[#a855f7] font-bold">{totalXp}</span> / {nextLevelXp} XP</span>
            </div>
            <div class="w-full h-[5px] bg-white/10 rounded-full mb-1.5 overflow-hidden">
               <div class="h-full bg-gradient-to-r from-[#9333EA] to-[#c084fc] rounded-full" style="width: {progressPercent}%"></div>
            </div>
            <span class="text-[9px] text-white/40"><span class="text-[#a855f7] font-bold">{progressPercent}%</span> até o nível {currentLevel + 1}</span>
         </div>
         


         <div class="flex flex-col items-center justify-center border-l border-white/5 h-full pl-2.5 cursor-pointer hover:bg-white/5 rounded-[8px] transition-colors px-1" on:click={() => navigate('quests', { tab: 'loja' })}>
            <div class="text-[16px] drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] mb-0.5">🪙</div>
            <span class="text-[9px] text-white/50">Moedas</span>
            <span class="text-[10px] font-bold text-yellow-500 leading-tight">{$player.coins || 0}</span>
         </div>

         <div class="flex flex-col items-center justify-center border-l border-white/5 h-full pl-2.5 cursor-pointer hover:bg-white/5 rounded-[8px] transition-colors px-1" on:click={() => navigate('quests', { tab: 'loja' })}>
            <div class="text-[16px] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] mb-0.5">💎</div>
            <span class="text-[9px] text-white/50">Pro Coins</span>
            <span class="text-[10px] font-bold text-[#a855f7] leading-tight">{$player.proCoins || 0}</span>
         </div>
      </div>
    </div>
  {/if}

  <!-- Stats Grid -->
  <div class="grid grid-cols-4 gap-2 mt-4">
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-[#a855f7] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{missionsCount}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Missões</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-green-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{habitsCompleted}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Hábitos</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-yellow-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{achievementsCount}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">Conquistas</span>
    </div>
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center">
       <svg class="w-5 h-5 text-blue-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
       <span class="text-white text-[13px] font-bold leading-none mb-0.5">{totalXp}</span>
       <span class="text-[8px] text-white/50 uppercase tracking-wide">XP Total</span>
    </div>
  </div>

  <!-- Sua Jornada -->
  <div class="bg-[#111115] border border-white/5 rounded-[32px] p-5 mt-4 relative shadow-2xl overflow-hidden">
    <!-- Glow de fundo sutil -->
    <div class="absolute top-0 left-0 w-full h-32 bg-[#9333EA]/10 blur-[60px] pointer-events-none"></div>

    <div class="flex items-start justify-between mb-10 relative z-10 px-2">
       <div>
         <h3 class="text-[16px] sm:text-[18px] font-bold text-white flex items-center gap-1.5">
           Sua jornada e <span class="text-[#a855f7]">Recompensas</span>
         </h3>
         <p class="text-white/40 text-[11px] sm:text-[12px] mt-1.5 font-medium">Cada nível conquistado te aproxima da sua melhor versão.</p>
       </div>
       <div class="text-[11px] bg-[#1a1a24] border border-[#2a2a35] px-3 py-1.5 rounded-full text-white font-bold flex items-center gap-1.5 shadow-lg shrink-0">
         <svg class="w-3.5 h-3.5 text-[#a855f7]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
         Lvl {currentLevel}
       </div>
    </div>

    <div class="flex justify-between items-center relative px-0 sm:px-2 mb-8">
       <!-- linha base contínua fina -->
       <div class="absolute top-[35px] left-[15%] right-[15%] h-[2px] bg-white/5 z-0"></div>
       <!-- <div class="absolute top-[35px] left-[15%] w-1/4 h-[2px] bg-gradient-to-r from-[#a855f7] to-[#d8b4fe] shadow-[0_0_8px_#a855f7] z-0"></div> -->
       
       <button class="relative z-10 w-8 h-8 rounded-full bg-[#181820] border border-white/10 flex items-center justify-center text-white/60 text-[14px] shrink-0 hover:bg-white/10 transition-all shadow-lg {timelineOffset === 0 ? 'opacity-0 pointer-events-none' : ''}" on:click={() => scrollTimeline('prev')}>
         ‹
       </button>

       {#each timelineNodes as node}
         <div class="relative z-10 flex flex-col items-center w-[60px] sm:w-[70px] transition-all duration-300">
            {#if node.status === 'active'}
               <div class="relative">
                 <div class="absolute inset-0 bg-[#a855f7] blur-xl opacity-30 rounded-full"></div>
                 <div class="w-[70px] h-[80px] sm:w-[80px] sm:h-[90px] flex flex-col items-center justify-center clip-hex bg-[#121216] text-white border-[2px] border-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.4)] relative z-10 pb-2 pt-2">
                   <svg class="w-5 h-5 sm:w-6 sm:h-6 text-[#a855f7] mb-1 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                     <path d={node.iconPath} />
                   </svg>
                   <span class="text-[20px] sm:text-[24px] font-black leading-none">{node.level}</span>
                 </div>
               </div>
               <div class="flex flex-col items-center mt-3 h-[60px]">
                 <span class="text-[12px] sm:text-[13px] font-bold text-[#a855f7] text-center leading-tight tracking-wide drop-shadow-md whitespace-nowrap">{node.title}</span>
                 <span class="text-[10px] text-white/40 mt-1 font-medium">{node.xp ? node.xp : ''}</span>
                 {#if node.hasReward}
                    <div class="mt-2 text-[20px] sm:text-[24px] drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-bounce" title="Recompensa disponivel!">🎁</div>
                 {/if}
               </div>
            {:else}
               <div class="w-[55px] h-[64px] sm:w-[60px] sm:h-[70px] flex flex-col items-center justify-center clip-hex bg-[#181820] text-white/80 border border-white/5 shadow-inner pb-1 pt-1 mt-2">
                 <svg class="w-4 h-4 sm:w-5 sm:h-5 {node.color} mb-1 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d={node.iconPath} />
                 </svg>
                 <span class="text-[15px] sm:text-[17px] font-bold leading-none">{node.level}</span>
               </div>
               <div class="flex flex-col items-center mt-3 h-[60px]">
                  <span class="text-[10px] sm:text-[11px] {node.color} font-medium text-center leading-tight whitespace-nowrap opacity-90">{node.title}</span>
                  <span class="text-[9px] sm:text-[10px] text-white/30 mt-1 font-medium">{node.xp ? node.xp : ''}</span>
                  
                  {#if node.status === 'completed'}
                    <div class="mt-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-[#22c55e]/50 flex items-center justify-center bg-[#22c55e]/10">
                      <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#22c55e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  {:else if node.hasReward}
                    <div class="mt-2 text-[14px] sm:text-[16px] drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] opacity-70 animate-bounce">🎁</div>
                  {/if}
               </div>
            {/if}
         </div>
       {/each}
       
       <button class="relative z-10 w-8 h-8 rounded-full bg-[#181820] border border-white/10 flex items-center justify-center text-white/60 text-[14px] shrink-0 hover:bg-white/10 transition-all shadow-lg {(currentLevel + timelineOffset + 3) >= MAX_LEVEL ? 'opacity-0 pointer-events-none' : ''}" on:click={() => scrollTimeline('next')}>
         ›
       </button>
    </div>

    <!-- Bottom Reward Panel -->
    <div class="bg-[#181820]/80 border border-white/5 rounded-[20px] p-4 flex flex-col md:flex-row md:items-center gap-4 relative z-10">
      <div class="flex items-center gap-3 shrink-0">
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 sm:w-6 sm:h-6 text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="14" rx="2"/><path d="M12 5a3 3 0 1 0-3 3"/><path d="M15 5a3 3 0 1 0-3 3"/><path d="M12 5v3"/><path d="M12 8v14"/></svg>
        </div>
        <div>
          <h4 class="text-white text-[13px] sm:text-[14px] font-bold leading-tight">Recompensa do próximo nível</h4>
          <p class="text-[9px] sm:text-[10px] text-white/40 mt-1">Ao alcançar o nível {nextRewardLevel} você desbloqueia:</p>
        </div>
      </div>
      
      <div class="flex gap-2 overflow-x-auto pb-2 flex-1 scrollbar-hide pt-1">
         {#if nextReward?.coins > 0}
         <div class="bg-[#1C1C22] border border-white/5 rounded-[12px] p-2.5 flex items-center gap-2.5 shrink-0 min-w-[120px]">
           <svg class="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
           <div>
             <div class="text-[11px] font-bold text-white leading-none">+{nextReward.coins}</div>
             <div class="text-[9px] text-white/40 mt-1">Lifecoins</div>
           </div>
         </div>
         {/if}
         
         {#if nextReward?.proCoins > 0}
         <div class="bg-[#1C1C22] border border-white/5 rounded-[12px] p-2.5 flex items-center gap-2.5 shrink-0 min-w-[120px]">
           <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 11.5l9.1-9.1c.4-.4 1-.4 1.4 0l9.1 9.1c.4.4.4 1 0 1.4l-9.1 9.1c-.4.4-1 .4-1.4 0l-9.1-9.1c-.4-.4-.4-1 0-1.4z"/></svg>
           <div>
             <div class="text-[11px] font-bold text-white leading-none">+{nextReward.proCoins}</div>
             <div class="text-[9px] text-white/40 mt-1">Pro Coins</div>
           </div>
         </div>
         {/if}
         
         {#if isMilestoneLevel(nextRewardLevel)}
         <div class="bg-[#1C1C22] border border-white/5 rounded-[12px] p-2.5 flex items-center gap-2.5 shrink-0 min-w-[130px]">
           <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
           <div>
             <div class="text-[11px] font-bold text-white leading-none">Novo título</div>
             <div class="text-[9px] text-white/40 mt-1">{getTitleForLevel(nextRewardLevel).title}</div>
           </div>
         </div>
         {/if}
      </div>
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

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={() => navigate('quests', { tab: 'conquistas' })}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Ver as conquistas</h4>
              <p class="text-[10px] text-white/40">Acompanhe suas medalhas e troféus</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>

     <button class="flex items-center justify-between px-5 py-3.5 group hover:bg-white/5 transition-colors" on:click={() => navigate('quests', { tab: 'loja' })}>
        <div class="flex items-center gap-3">
           <svg class="w-[20px] h-[20px] text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12A4 4 0 0 0 8 12M12 16v.01"/></svg>
           <div class="text-left">
              <h4 class="text-[12px] font-bold text-white mb-0.5">Loja do LifeQuest</h4>
              <p class="text-[10px] text-white/40">Gaste suas moedas em recompensas</p>
           </div>
        </div>
        <span class="text-white/20 text-sm group-hover:text-white/50">›</span>
     </button>
  </div>

  <!-- Atividade da Semana -->
  <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-5 mt-4 relative overflow-hidden group">
    <!-- Efeito de brilho de fundo -->
    <div class="absolute -right-10 -top-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-all duration-500"></div>

    <div class="flex items-center justify-between mb-5 relative z-10">
       <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
             <svg class="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12,22A10,10,0,0,1,2.83,16c.45-.48.91-1,1.4-1.42A7,7,0,0,0,10,21.57c0-2.31-1.31-3.64-2.8-5.2C5.58,14.65,4,13,4,9.5A8,8,0,0,1,12,2a5,5,0,0,0,1,5c0,1-1,2-1,3,1.69-1.07,4-2,5-4a6.52,6.52,0,0,1,1,3.46c0,4-2.58,6-5,7a4.42,4.42,0,0,0,2.15-1.5,10,10,0,0,1-2.15,3Z"/></svg>
          </div>
          <div>
             <h3 class="text-[13px] font-bold text-white leading-tight">Sua Ofensiva</h3>
             <p class="text-[9px] text-white/50">Mantenha a constância</p>
          </div>
       </div>
       <div class="text-right">
          <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold">Sequência</p>
          <p class="text-[16px] font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{streak} dia{streak !== 1 ? 's' : ''} {#if streak > 0}<span class="animate-pulse">🔥</span>{/if}</p>
       </div>
    </div>

    <div class="flex justify-between items-end gap-1.5 relative z-10">
      {#each streakActivity as day}
         <div class="flex flex-col items-center gap-2 flex-1">
            <div class="w-full max-w-[36px] h-12 rounded-[10px] flex items-center justify-center transition-all duration-300 {day.active ? 'bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] border border-orange-400/50' : day.isToday ? 'bg-white/10 border border-white/20' : 'bg-surface border border-white/5'}">
              {#if day.active}
                 <span class="text-white text-[15px] drop-shadow-md">🔥</span>
              {/if}
            </div>
            <span class="text-[9px] font-bold uppercase tracking-wider {day.isToday ? 'text-orange-400' : day.active ? 'text-white/80' : 'text-white/30'}">{day.label}</span>
         </div>
      {/each}
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
