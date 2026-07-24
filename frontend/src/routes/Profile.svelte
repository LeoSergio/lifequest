<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { ACHIEVEMENTS } from '../lib/achievements.js';
  import { navigate } from '../lib/nav.js';

  const player = liveQuery(() => db.player.toCollection().first());
  const unlockedAchievements = liveQuery(async () => {
    const list = await db.unlockedAchievements.toArray();
    return new Set(list.map(a => a.achievementId));
  });

  $: myMedals = ACHIEVEMENTS.filter(a => $unlockedAchievements?.has(a.id));
  $: totalXp = $player?.xp ?? 0; // Using current XP as total for simplicity
  $: nextLevelXp = ($player?.level ?? 1) * 100;
  $: progressPercent = Math.min(100, Math.round((totalXp / nextLevelXp) * 100));

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      if ($player) {
        await db.player.update($player.id, { avatar: base64 });
      }
    };
    reader.readAsDataURL(file);
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto flex flex-col">
  
  <!-- CABEÇALHO -->
  <div class="flex justify-between items-start mb-6 mt-4">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight mb-1">Perfil do Herói</h1>
      <p class="text-[13px] text-white/50">Sua jornada e estatísticas.</p>
    </div>
    <button class="w-10 h-10 bg-[#1C1C22]/80 border border-white/5 rounded-[12px] flex items-center justify-center shadow-inner hover:bg-white/5 transition-colors text-white/60">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
    </button>
  </div>

  {#if $player}
    <div class="flex items-start gap-4 mb-6">
      <!-- Avatar -->
      <div class="relative shrink-0">
        <label class="block w-[90px] h-[90px] rounded-full border-[3px] border-[#9333EA] shadow-[0_0_20px_rgba(147,51,234,0.4)] overflow-hidden cursor-pointer bg-surface flex items-center justify-center text-3xl">
          {#if $player?.avatar}
             {#if $player.avatar.startsWith('data:image')}
               <img src={$player.avatar} alt="Avatar" class="w-full h-full object-cover" />
             {:else}
               <span>{$player.avatar}</span>
             {/if}
          {:else}
             <span>👤</span>
          {/if}
          <input type="file" accept="image/*" class="hidden" on:change={handleImageUpload} />
        </label>
        <!-- Badge Câmera -->
        <label class="absolute bottom-0 right-0 bg-[#9333EA] text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-bg cursor-pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <input type="file" accept="image/*" class="hidden" on:change={handleImageUpload} />
        </label>
      </div>

      <!-- Info e Progresso -->
      <div class="flex-1 flex flex-col justify-center pt-2 min-w-0">
        <h2 class="text-white text-[15px] mb-3 truncate">Olá, <span class="font-bold text-[#a855f7]">{$player.name || 'Aventureiro'}</span> 👋</h2>
        
        <div class="flex items-start gap-4">
          <!-- Level Badge -->
          <div class="flex flex-col items-center shrink-0">
            <div class="relative w-14 h-16 bg-gradient-to-b from-[#9333EA] to-[#5b21b6] rounded-[12px] flex flex-col items-center justify-center shadow-lg border border-[#a855f7]/50">
               <span class="text-[9px] text-white/80 uppercase font-black absolute top-2 tracking-wider">Nível</span>
               <span class="text-[24px] font-black text-white mt-2 leading-none">{$player.level}</span>
            </div>
            <span class="bg-[#1C1C22] text-[#a855f7] border border-[#a855f7]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-2 uppercase tracking-wide">Iniciante</span>
          </div>

          <!-- Progress bar and details -->
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-end mb-2">
              <span class="text-[11px] text-white/70 font-medium">Seu progresso</span>
              <span class="text-[11px] text-white/50"><span class="text-[#a855f7] font-bold">{$player.xp}</span> / {nextLevelXp} XP</span>
            </div>
            <div class="w-full h-1.5 bg-white/10 rounded-full mb-1.5 overflow-hidden">
               <div class="h-full bg-gradient-to-r from-[#9333EA] to-[#c084fc] rounded-full transition-all duration-500" style="width: {progressPercent}%"></div>
            </div>
            <p class="text-[10px] font-medium"><span class="text-[#a855f7] font-bold">{progressPercent}%</span> <span class="text-white/50">até o nível {$player.level + 1}</span></p>

            <div class="flex items-center justify-between mt-4">
               <div class="flex items-center gap-4 text-[12px] font-bold text-white/80">
                  <span class="flex items-center gap-1.5 whitespace-nowrap">🔥 Streak: {$player.streak || 0} d</span>
                  <span class="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-[0_0_8px_rgba(234,179,8,0.1)] whitespace-nowrap">
                     💰 {$player.coins || 0}
                  </span>
               </div>
               <span class="text-white/30 text-sm font-light">›</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Stats Row -->
  <div class="bg-[#1C1C22]/80 backdrop-blur-md rounded-[20px] p-4 flex justify-between items-center border border-white/5 shadow-inner mb-5">
    <div class="flex flex-col items-center text-center px-1">
      <div class="flex items-center gap-1 text-[17px] font-black text-white mb-0.5">
        <span class="text-[#a855f7] text-[15px]">🎯</span> 8
      </div>
      <p class="text-[9px] text-white/50 font-medium leading-tight w-[45px]">Metas concl.</p>
    </div>
    <div class="w-px h-8 bg-white/5"></div>
    <div class="flex flex-col items-center text-center px-1">
      <div class="flex items-center gap-1 text-[17px] font-black text-white mb-0.5">
        <span class="text-green-500 text-[15px]">✅</span> 15
      </div>
      <p class="text-[9px] text-white/50 font-medium leading-tight w-[45px]">Hábitos concl.</p>
    </div>
    <div class="w-px h-8 bg-white/5"></div>
    <div class="flex flex-col items-center text-center px-1">
      <div class="flex items-center gap-1 text-[17px] font-black text-white mb-0.5">
        <span class="text-red-500 text-[15px]">🔥</span> 1
      </div>
      <p class="text-[9px] text-white/50 font-medium leading-tight w-[45px]">Maior seq.</p>
    </div>
    <div class="w-px h-8 bg-white/5"></div>
    <div class="flex flex-col items-center text-center px-1">
      <div class="flex items-center gap-1 text-[17px] font-black text-white mb-0.5">
        <span class="text-yellow-500 text-[15px]">★</span> {totalXp}
      </div>
      <p class="text-[9px] text-white/50 font-medium leading-tight w-[45px]">XP total acm.</p>
    </div>
  </div>

  <!-- Grids para Conquistas e Chart (2 Colunas em desktop, empilhado no mobile para não quebrar layout, mas inspirado na imagem que é lado a lado) -->
  <div class="flex flex-col gap-3 mb-6">
    <!-- Conquistas -->
    <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[24px] p-4 shadow-inner">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-[13px] font-bold text-white">Conquistas recentes</h3>
        <button class="text-[10px] text-[#a855f7] font-medium flex items-center gap-1" on:click={() => navigate('quests')}>Ver todas <span>›</span></button>
      </div>
      <div class="flex justify-between px-2">
        {#each (myMedals || []).slice(0, 3) as medal}
           <div class="flex flex-col items-center">
             <div class="w-14 h-[60px] flex items-center justify-center text-2xl shadow-lg border border-white/10 rounded-xl {medal.bg}">
                {medal.icon}
             </div>
             <span class="text-[9px] text-white/80 mt-2 text-center max-w-[50px] leading-tight font-medium">{medal.name}</span>
           </div>
        {/each}
        {#if (myMedals || []).length === 0}
           <p class="text-xs text-white/40 w-full text-center py-4">Nenhuma conquista ainda. Cumpra suas metas!</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Links / Configurações (Duas Colunas) -->
  <div class="grid grid-cols-2 gap-3 mb-4">
    <!-- Coluna 1 -->
    <div>
       <h3 class="text-[13px] font-bold text-white mb-3 pl-1">Conta e preferências</h3>
       <div class="flex flex-col gap-3 pl-1">
          <button class="flex items-center justify-between w-full group py-1">
             <div class="flex items-center gap-2.5 text-white/70 group-hover:text-white transition-colors">
                <svg class="w-[18px] h-[18px] text-[#3b82f6]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> 
                <span class="text-[12px] font-medium">Editar perfil</span>
             </div>
             <span class="text-white/20 text-sm">›</span>
          </button>
          <button class="flex items-center justify-between w-full group py-1">
             <div class="flex items-center gap-2.5 text-white/70 group-hover:text-white transition-colors">
                <svg class="w-[18px] h-[18px] text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span class="text-[12px] font-medium">Privacidade</span>
             </div>
             <span class="text-white/20 text-sm">›</span>
          </button>
       </div>
    </div>

    <!-- Coluna 2 -->
    <div>
       <h3 class="text-[13px] font-bold text-white mb-3 pl-1">Ferramentas</h3>
       <div class="flex flex-col gap-3 pl-1">
          <button class="flex items-center justify-between w-full group py-1">
             <div class="flex items-center gap-2.5 text-white/70 group-hover:text-white transition-colors">
                <svg class="w-[18px] h-[18px] text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                <span class="text-[12px] font-medium">Backup de dados</span>
             </div>
             <span class="text-white/20 text-sm">›</span>
          </button>
          <button class="flex items-center justify-between w-full group py-1">
             <div class="flex items-center gap-2.5 text-white/70 group-hover:text-white transition-colors">
                <svg class="w-[18px] h-[18px] text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <span class="text-[12px] font-medium">Exportar dados</span>
             </div>
             <span class="text-white/20 text-sm">›</span>
          </button>
          <button class="flex items-center justify-between w-full group py-1">
             <div class="flex items-center gap-2.5 text-white/70 group-hover:text-white transition-colors">
                <svg class="w-[18px] h-[18px] text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                <span class="text-[12px] font-medium">Central de ajuda</span>
             </div>
             <span class="text-white/20 text-sm">›</span>
          </button>
       </div>
    </div>
  </div>

</main>
