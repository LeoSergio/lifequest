<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { todayIso } from '../lib/habits.js';
  import { applyXp } from '../lib/gamification.js';
  import { ACHIEVEMENTS } from '../lib/achievements.js';
  
  let currentTab = 'diarias'; // 'diarias', 'semanais', 'mensais', 'conquistas'
  let isLoadingQuests = false;
  let isLoadingEpic = false;

  let showRoulette = false;
  let roulettePrize = null;
  let isSpinning = false;
  let currentRouletteIndex = 0;
  let rouletteItems = [
    { name: '10 LifeCoins', value: 10, type: 'coins', icon: '💰' },
    { name: '20 LifeCoins', value: 20, type: 'coins', icon: '💰' },
    { name: '50 LifeCoins', value: 50, type: 'coins', icon: '💰' },
    { name: 'Poção de Gelo', value: 1, type: 'item', itemId: 'potion_freeze', icon: '❄️' },
    { name: '100 XP Extra', value: 100, type: 'xp', icon: '✨' }
  ];

  const player = liveQuery(() => db.player.toCollection().first());
  
  // As missões diárias de HOJE
  const dailyQuests = liveQuery(async () => {
    const today = todayIso();
    return await db.dailyQuests.where('date').equals(today).toArray();
  });

  // Metas (para servirem como Boss Fights Mensais/Épicas)
  const goals = liveQuery(() => db.goals.toArray());

  // Conquistas Desbloqueadas
  const unlockedAchievements = liveQuery(async () => {
    const list = await db.unlockedAchievements.toArray();
    return new Set(list.map(a => a.achievementId));
  });

  // Função para pedir novas missões para a IA
  async function fetchDailyQuests() {
    if (!$player) return;
    isLoadingQuests = true;
    
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/ai/quests/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_level: $player.level,
          focus_areas: ["saúde", "desenvolvimento pessoal", "organização"]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const today = todayIso();
        
        // Salva no banco local
        for (const q of data.quests) {
          await db.dailyQuests.add({
            date: today,
            pillar: q.pillar,
            title: q.title,
            description: q.description,
            xpReward: q.xp_reward,
            completed: false
          });
        }
      }
    } catch (e) {
      console.error("Erro ao gerar missões:", e);
      alert("Não foi possível contatar o Mestre do Jogo (IA). Tente novamente mais tarde.");
    } finally {
      isLoadingQuests = false;
    }
  }

  // Função para pedir um Chefão (Missão Épica) para a IA
  async function fetchEpicQuest() {
    if (!$player) return;
    isLoadingEpic = true;
    
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/ai/quests/epic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_level: $player.level
        })
      });
      
      if (response.ok) {
        const epic = await response.json();
        
        const now = new Date();
        const deadline = new Date();
        deadline.setDate(now.getDate() + epic.deadline_days);
        
        await db.goals.add({
          title: epic.title,
          targetValue: epic.target_value,
          currentValue: 0,
          unit: epic.unit,
          reward: epic.description,
          xpReward: epic.xp_reward,
          deadline: deadline.toISOString().slice(0, 10),
          createdAt: now.toISOString()
        });
      }
    } catch (e) {
      console.error("Erro ao gerar missão épica:", e);
      alert("Falha ao invocar o Chefão. Tente novamente.");
    } finally {
      isLoadingEpic = false;
    }
  }

  // Completa a missão
  async function completeQuest(quest) {
    if (quest.completed) return;
    
    await db.dailyQuests.update(quest.id, { completed: true });
    
    const p = await db.player.toCollection().first();
    const { level, xp, leveledUp } = applyXp(p.level, p.xp, quest.xpReward);
    let newCoins = p.coins || 0;
    
    const today = todayIso();
    const allTodayQuests = await db.dailyQuests.where('date').equals(today).toArray();
    const allCompleted = allTodayQuests.every(q => q.completed);
    
    let gotChest = false;
    let coinsEarned = 0;
    
    if (allCompleted) {
       coinsEarned = 15;
       newCoins += coinsEarned;
       gotChest = true;
    }

    await db.player.update(p.id, { level, xp, coins: newCoins });
    
    if (gotChest) {
      setTimeout(() => {
        alert(`🎁 BAÚ DIÁRIO ABERTO! Você completou as 3 missões e ganhou ${coinsEarned} LifeCoins!`);
      }, 300);
    }
    
    if (leveledUp) {
      alert(`🎉 Level Up! Você alcançou o nível ${level}!`);
    }
  }

  // Ataca o Chefão (Missão Épica)
  async function attackBoss(goal) {
    if (goal.achievedAt) return; // Já está morto

    let damage = 1;
    if (goal.unit.toLowerCase() !== 'dias' && goal.unit.toLowerCase() !== 'treinos' && goal.unit.toLowerCase() !== 'dias seguidos') {
      const input = prompt(`Quanto de dano (${goal.unit}) você causou hoje ao ${goal.title}?`);
      if (!input) return;
      damage = parseInt(input);
      if (isNaN(damage) || damage <= 0) return;
    } else {
      const confirmAttack = confirm(`Deseja realizar o ataque diário (1 ${goal.unit}) contra o ${goal.title}?`);
      if (!confirmAttack) return;
    }

    const newValue = Math.min(goal.targetValue, goal.currentValue + damage);
    await db.goals.update(goal.id, { currentValue: newValue });
    
    if (newValue >= goal.targetValue) {
      await db.goals.update(goal.id, { achievedAt: new Date().toISOString() });
      const p = await db.player.toCollection().first();
      const { level, xp, leveledUp } = applyXp(p.level, p.xp, goal.xpReward);
      
      const bossCoins = Math.floor(goal.xpReward / 5);
      const newCoins = (p.coins || 0) + bossCoins;
      
      await db.player.update(p.id, { level, xp, coins: newCoins });
      
      alert(`🎉 CHEFÃO DERROTADO! Você ganhou ${goal.xpReward} XP e 💰 ${bossCoins} LifeCoins!`);
      if (leveledUp) alert(`Level Up! Nível ${level} alcançado!`);
    } else {
      alert(`💥 Pow! Você causou ${damage} de dano!`);
    }
  }

  async function spinRoulette() {
    if (isSpinning) return;
    isSpinning = true;
    
    let spins = 12 + Math.floor(Math.random() * 8);
    let speed = 150;
    
    for (let i = 0; i < spins; i++) {
      currentRouletteIndex = (currentRouletteIndex + 1) % rouletteItems.length;
      await new Promise(r => setTimeout(r, speed));
      speed += 25;
    }
    
    const prize = rouletteItems[currentRouletteIndex];
    roulettePrize = prize;
    
    const p = await db.player.toCollection().first();
    if (prize.type === 'coins') {
      await db.player.update(p.id, { coins: (p.coins || 0) + prize.value });
    } else if (prize.type === 'xp') {
      const { level, xp } = applyXp(p.level, p.xp, prize.value);
      await db.player.update(p.id, { level, xp });
    } else if (prize.type === 'item') {
      await db.inventory.add({
        itemId: prize.itemId,
        category: 'consumable',
        name: prize.name,
        purchasedAt: new Date().toISOString()
      });
    }
    
    isSpinning = false;
  }
  
  function closeRoulette() {
    showRoulette = false;
    roulettePrize = null;
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto flex flex-col gap-5">
  
  <div class="px-2 mt-4">
    <h1 class="text-3xl font-black text-white tracking-tight mb-1">Missões</h1>
    <p class="text-[13px] text-white/50">Desafios do dia rendem XP extra.</p>
  </div>

  <!-- Tabs -->
  <div class="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-2 mb-2">
    <button
      class="px-5 py-2.5 rounded-full font-bold text-[13px] transition-all whitespace-nowrap {currentTab === 'diarias' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}"
      on:click={() => (currentTab = 'diarias')}
    >
      Diárias
    </button>
    <button
      class="px-5 py-2.5 rounded-full font-bold text-[13px] transition-all whitespace-nowrap {currentTab === 'semanais' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}"
      on:click={() => (currentTab = 'semanais')}
    >
      Semanais
    </button>
    <button
      class="px-5 py-2.5 rounded-full font-bold text-[13px] transition-all whitespace-nowrap {currentTab === 'mensais' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}"
      on:click={() => (currentTab = 'mensais')}
    >
      Épicas
    </button>
    <button
      class="px-5 py-2.5 rounded-full font-bold text-[13px] transition-all whitespace-nowrap {currentTab === 'conquistas' ? 'bg-[#9333EA] text-black shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}"
      on:click={() => (currentTab = 'conquistas')}
    >
      Conquistas
    </button>
  </div>

  <!-- Missões Diárias -->
  {#if currentTab === 'diarias'}
    {#if $dailyQuests && $dailyQuests.length > 0}
      {@const completedCount = $dailyQuests.filter(q => q.completed).length}
      {@const totalCount = $dailyQuests.length}
      {@const chestProgress = (completedCount / totalCount) * 100}
      
      <!-- Progress Bar para o Baú -->
      <div class="bg-surface/80 border border-white/5 rounded-2xl p-4 mb-4 flex flex-col gap-2 relative overflow-hidden">
        <div class="flex justify-between items-end">
          <span class="text-[11px] font-bold text-white/60 uppercase tracking-wider">Baú Diário</span>
          <span class="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md">+15 💰</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-full bg-black/40 rounded-full h-2.5 border border-white/10 relative overflow-hidden">
            <div class="bg-gradient-to-r from-primary to-yellow-500 h-full transition-all duration-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" style="width: {chestProgress}%"></div>
          </div>
          <span class="text-2xl filter transition-all duration-300 {completedCount === totalCount ? 'drop-shadow-[0_0_12px_rgba(234,179,8,0.8)] scale-110' : 'opacity-50 grayscale'}">🎁</span>
        </div>
        <p class="text-[9px] text-white/40 uppercase tracking-widest mt-1">{completedCount} DE {totalCount} MISSÕES CONCLUÍDAS</p>
      </div>

      <div class="flex flex-col gap-3">
        {#each $dailyQuests as quest}
          <button 
            on:click={() => completeQuest(quest)}
            class="w-full text-left bg-surface/80 border {quest.completed ? 'border-primary/50 opacity-60' : 'border-white/10 hover:border-primary/40'} rounded-2xl p-4 transition-all relative overflow-hidden"
          >
            {#if quest.completed}
              <div class="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none">
                <span class="text-6xl opacity-10">✔️</span>
              </div>
            {/if}
            
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-sm">{quest.pillar}</span>
                </div>
                <h3 class="text-white font-bold leading-tight mb-1 {quest.completed ? 'line-through text-white/50' : ''}">{quest.title}</h3>
                <p class="text-xs text-white/60 leading-relaxed">{quest.description}</p>
              </div>
              
              <div class="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl {quest.completed ? 'bg-primary/20 text-primary' : 'bg-xp/20 text-xp'}">
                <span class="text-[10px] font-black uppercase mb-[-2px]">XP</span>
                <span class="text-sm font-black">{quest.xpReward}</span>
              </div>
            </div>
          </button>
        {/each}
        
        {#if $dailyQuests && $dailyQuests.length > 0 && $dailyQuests.every(q => q.completed)}
          <div class="mt-4 p-4 rounded-xl border border-xp/30 bg-xp/10 text-center animate-pulse">
            <h3 class="text-xp font-bold mb-1">🏆 Todas completas!</h3>
            <p class="text-xs text-white/70">Volte amanhã para novos desafios do Mestre.</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Estado Vazio (Precisa gerar) -->
      <div class="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-white/10 rounded-[32px] relative overflow-hidden mt-4 mx-2">
        <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-20 pointer-events-none"></div>
        
        <div class="w-24 h-24 rounded-full bg-surface/50 border border-white/5 flex items-center justify-center shadow-[0_0_40px_rgba(147,51,234,0.15)] mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="M4.93 4.93l1.41 1.41"></path>
            <path d="M17.66 17.66l1.41 1.41"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="M6.34 17.66l-1.41 1.41"></path>
            <path d="M19.07 4.93l-1.41 1.41"></path>
          </svg>
        </div>
        
        <h3 class="text-[22px] font-black text-white mb-4 leading-tight tracking-tight">O quadro de missões está em<br>branco</h3>
        <p class="text-[13.5px] text-white/50 mb-8 max-w-[280px] leading-relaxed">Suas missões diárias ainda não foram sorteadas. Revele-as para saber o que a Guilda espera de você hoje.</p>
        
        <button 
          on:click={fetchDailyQuests}
          disabled={isLoadingQuests}
          class="w-full max-w-[260px] bg-[#9333EA] text-black font-black text-[15px] py-4 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.4)] disabled:opacity-50 transition-transform active:scale-95"
        >
          {isLoadingQuests ? 'Consultando...' : 'Revelar missões de hoje'}
        </button>
      </div>
    {/if}
  {/if}

  <!-- Missões Semanais -->
  {#if currentTab === 'semanais'}
    <div class="flex flex-col gap-3">
      
      <div class="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-4 flex items-start gap-3 mb-1">
        <span class="text-3xl filter drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">🎁</span>
        <div>
          <h3 class="text-sm font-bold text-yellow-500 mb-1">Recompensa Semanal</h3>
          <p class="text-[10px] text-white/60 leading-relaxed">Conclua todos os marcos de uma missão semanal para liberar um giro na Roleta da Sorte. Você pode ganhar até 50 LifeCoins ou Poções!</p>
        </div>
      </div>

      <div class="bg-surface/80 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
        <div class="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none">
          <span class="text-6xl opacity-10">✔️</span>
        </div>
        
        <h3 class="text-white font-bold mb-1 text-sm">Guerreiro de Ferro</h3>
        <p class="text-xs text-white/50 mb-3">Complete 4 treinos na semana.</p>
        <div class="w-full bg-white/5 rounded-full h-1.5 mb-2">
          <div class="bg-blue-500 h-full rounded-full w-full"></div>
        </div>
        <p class="text-[10px] text-right mt-1 text-white/40 mb-3">4 / 4 treinos</p>
        
        <button 
          on:click={() => showRoulette = true}
          class="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black py-2 rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>🎰</span> GIRAR ROLETA SEMANAL
        </button>
      </div>
    </div>
  {/if}

  <!-- Missões Mensais (Epic) -->
  {#if currentTab === 'mensais'}
    <div class="flex flex-col gap-4">
      <div class="p-1">
        <h2 class="text-sm font-bold text-danger mb-1 flex items-center gap-2">
          <span>🐲</span> Chefões Ativos (Metas)
        </h2>
        <p class="text-xs text-white/50">O progresso das suas metas ataca o chefão.</p>
      </div>

      {#if $goals && $goals.length > 0}
        {#each $goals as goal}
          <div class="bg-surface/80 border border-danger/20 rounded-2xl p-4 overflow-hidden relative">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-danger/10 blur-2xl rounded-full"></div>
            
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-white font-bold">{goal.title}</h3>
              <span class="text-xs font-black text-danger bg-danger/20 px-2 py-0.5 rounded-md">BOSS</span>
            </div>
            
            <p class="text-xs text-white/60 mb-4">Progresso: {goal.currentValue} de {goal.targetValue} {goal.unit}</p>
            
            <!-- HP Bar -->
            <div class="w-full bg-[#3a0000] rounded-full h-3 relative overflow-hidden border border-black mb-2">
              <div 
                class="bg-gradient-to-r from-red-600 to-danger h-full transition-all" 
                style="width: {100 - Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))}%"
              ></div>
            </div>
            
            <p class="text-[10px] text-white/50 italic mb-2">"{goal.reward}"</p>
            
            <div class="flex justify-between text-[9px] mt-1 text-white/40 font-bold uppercase mb-4">
              <span>Derrotado</span>
              <span>HP do Monstro</span>
            </div>

            {#if !goal.achievedAt}
              <button 
                on:click={() => attackBoss(goal)}
                class="w-full bg-danger/10 text-danger border border-danger/20 font-bold text-xs px-3 py-2 rounded-lg hover:bg-danger/20 transition-colors"
              >
                ⚔️ Atacar Chefão
              </button>
            {:else}
              <div class="w-full bg-green-500/10 text-green-500 border border-green-500/20 font-bold text-xs px-3 py-2 rounded-lg text-center">
                🏆 Monstro Derrotado!
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      <div class="mt-4 flex flex-col items-center p-4 bg-surface/50 border border-white/5 rounded-2xl">
        <p class="text-xs text-white/50 mb-3 text-center">Quer um novo desafio? O Mestre do Jogo pode conjurar um Chefão baseado no seu nível.</p>
        <button 
          on:click={fetchEpicQuest}
          disabled={isLoadingEpic}
          class="w-full bg-danger/20 text-danger border border-danger/30 font-bold text-sm px-4 py-3 rounded-xl hover:bg-danger/30 transition-colors disabled:opacity-50"
        >
          {isLoadingEpic ? 'Conjurando...' : '🧙‍♂️ Invocar Chefão com IA'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Conquistas (Achievements) -->
  {#if currentTab === 'conquistas'}
    <div class="flex flex-col gap-4">
      <div class="p-1">
        <h2 class="text-sm font-bold text-yellow-500 mb-1 flex items-center gap-2">
          <span>🏅</span> Mural de Medalhas
        </h2>
        <p class="text-xs text-white/50">Complete ações no app para desbloquear essas recompensas.</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        {#each ACHIEVEMENTS as ach}
          {@const isUnlocked = $unlockedAchievements ? $unlockedAchievements.has(ach.id) : false}
          <div class="bg-surface/80 border {isUnlocked ? 'border-yellow-500/30' : 'border-white/5'} rounded-2xl p-3 flex flex-col relative overflow-hidden group">
            
            <div class="flex justify-between items-start mb-2">
              <div class="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 shadow-md {isUnlocked ? ach.bg : 'bg-surface border-white/10 opacity-30'}">
                {ach.icon}
              </div>
              {#if isUnlocked}
                <span class="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-md uppercase">Desbloqueada</span>
              {:else}
                <span class="text-[9px] font-bold text-white/20 uppercase">Bloqueada</span>
              {/if}
            </div>
            
            <div class="flex-1 flex flex-col justify-start">
              <h3 class="font-bold text-white text-xs leading-tight mb-1 {isUnlocked ? '' : 'text-white/50'}">{ach.name}</h3>
              <p class="text-[9px] text-white/50 leading-relaxed line-clamp-2">{ach.description}</p>
            </div>
            
          </div>
        {/each}
      </div>
    </div>
  {/if}

</main>

{#if showRoulette}
  <div class="fixed inset-0 bg-bg/90 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
    <div class="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
      
      <h2 class="text-2xl font-black text-white mb-2 relative z-10 flex items-center gap-2">
        <span class="text-yellow-500">🎰</span> Roleta da Sorte
      </h2>
      <p class="text-xs text-white/50 mb-6 relative z-10">Você completou suas missões da semana! Gire a roleta para receber seu grande prêmio semanal.</p>
      
      <div class="w-full h-32 bg-bg border-y-2 border-primary/30 flex items-center justify-center relative overflow-hidden shadow-inner mb-6 rounded-lg">
        <div class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-white/5 z-0"></div>
        
        <div class="flex flex-col items-center justify-center relative z-10">
          <span class="text-5xl drop-shadow-lg mb-2">{rouletteItems[currentRouletteIndex].icon}</span>
          <span class="text-sm font-bold text-white">{rouletteItems[currentRouletteIndex].name}</span>
        </div>
        
        <!-- Pointers -->
        <div class="absolute left-1/2 -translate-x-1/2 top-0 text-primary drop-shadow-[0_0_5px_rgba(124,92,255,0.8)]">▼</div>
        <div class="absolute left-1/2 -translate-x-1/2 bottom-0 text-primary drop-shadow-[0_0_5px_rgba(124,92,255,0.8)] rotate-180">▼</div>
      </div>
      
      {#if !roulettePrize}
        <button 
          class="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(124,92,255,0.4)] disabled:opacity-50 active:scale-95 transition-all relative z-10"
          on:click={spinRoulette}
          disabled={isSpinning}
        >
          {isSpinning ? 'GIRANDO...' : 'GIRAR ROLETA!'}
        </button>
      {:else}
        <div class="w-full bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4 relative z-10 animate-fade-in">
          <p class="text-[10px] text-white/60 mb-1 uppercase tracking-wider font-bold">Você ganhou:</p>
          <p class="text-xl font-bold text-green-400 flex justify-center items-center gap-2">
            <span>{roulettePrize.icon}</span> {roulettePrize.name}!
          </p>
        </div>
        <button 
          class="w-full bg-surface border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/5 active:scale-95 transition-all relative z-10"
          on:click={closeRoulette}
        >
          Coletar Prêmio
        </button>
      {/if}
    </div>
  </div>
{/if}
