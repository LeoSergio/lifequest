<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { ACHIEVEMENTS } from '../lib/achievements.js';
  import { navigate } from '../lib/nav.js';
  import { showAlert, showConfirm, showPrompt } from '../lib/modal.js';

  const player = liveQuery(() => db.player.toCollection().first());
  const unlockedAchievements = liveQuery(async () => {
    const list = await db.unlockedAchievements.toArray();
    return new Set(list.map(a => a.achievementId));
  });

  $: myMedals = ACHIEVEMENTS.filter(a => $unlockedAchievements?.has(a.id));
  $: totalXp = $player?.xp ?? 0; // Using current XP as total for simplicity
  $: nextLevelXp = ($player?.level ?? 1) * 100;
  $: progressPercent = Math.min(100, Math.round((totalXp / nextLevelXp) * 100));

  const completedGoalsCount = liveQuery(async () => {
    const goals = await db.goals.toArray();
    return goals.filter(g => !!g.achievedAt).length;
  });

  const completedHabitsCount = liveQuery(async () => {
    return await db.habitCompletions.count();
  });

  const completedWorkoutsCount = liveQuery(async () => {
    const sessions = await db.workoutSessions.toArray();
    return sessions.filter(s => !!s.finishedAt).length;
  });

  const volumeTotal = liveQuery(async () => {
    const sets = await db.sessionSets.toArray();
    return sets.reduce((acc, set) => acc + ((set.weightKg || 0) * (set.repsDone || 0)), 0);
  });

  import { updatePlayer } from '../repositories/playerRepository.js';
  import { pushSync } from '../services/syncService.js';
  import { showProBenefits } from '../lib/pro.js';

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        if ($player) {
          await updatePlayer($player.id, { avatar: compressedBase64 });
          pushSync().catch(() => {});
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handleLogout() {
    const ok = await showConfirm({
      title: 'Sair e resetar dados?',
      message: 'Todos os dados locais serão apagados permanentemente. Esta ação não pode ser desfeita.',
      icon: '🗑️',
      type: 'danger',
      confirmText: 'Sim, sair e apagar',
      cancelText: 'Cancelar',
    });
    if (ok) {
      await db.delete();
      localStorage.removeItem('token');
      window.location.reload();
    }
  }

  async function handleSoftLogout() {
    const ok = await showConfirm({
      title: 'Sair da nuvem?',
      message: 'Você será deslogado, mas seus dados locais serão mantidos no dispositivo.',
      icon: '☁️',
      type: 'warning',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
    });
    if (ok) {
      localStorage.removeItem('token');
      window.location.reload();
    }
  }

  async function handleEditProfile() {
    if (!$player) return;
    const newName = await showPrompt({
      title: 'Editar perfil',
      message: 'Qual será o seu novo nome de herói?',
      icon: '✏️',
      placeholder: 'Seu nome de herói',
      defaultValue: $player.name,
      confirmText: 'Salvar',
    });
    if (newName) {
      await updatePlayer($player.id, { name: newName });
      pushSync().catch(() => {});
    }
  }

  function showPrivacyNote() {
    showAlert({
      title: 'Privacidade e Segurança',
      message: 'O LifeQuest usa arquitetura Local-First. SEUS dados pertencem a VOCÊ.\n\nSuas informações são armazenadas de forma segura no seu dispositivo. Apenas dados essenciais são sincronizados com a nuvem sob criptografia de trânsito.',
      icon: '🛡️',
      type: 'info',
      confirmText: 'Entendi',
    });
  }

  function showBackupNote() {
    showAlert({
      title: 'Como o backup funciona',
      message: 'A cada ação, o app salva imediatamente no banco local do navegador.\n\nEm seguida, os dados entram em uma fila segura e são sincronizados em background com nossos servidores — garantindo que você nunca perca nada, mesmo offline!',
      icon: '☁️',
      type: 'info',
      confirmText: 'Entendi',
    });
  }

  import jsPDF from 'jspdf';
  import 'jspdf-autotable';

  async function exportData() {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('LifeQuest - Relatorio de Jornada', 14, 22);
      
      if ($player) {
        doc.setFontSize(12);
        doc.text(`Heroi: ${$player.name}`, 14, 32);
        doc.text(`Nivel: ${$player.level} | XP: ${$player.xp} | Moedas: ${$player.coins}`, 14, 40);
        doc.text(`Maior Sequencia: ${$player.streak} dias`, 14, 48);
      }

      const goals = await db.goals.toArray();
      const completedGoals = goals.filter(g => !!g.achievedAt).length;
      
      const habits = await db.habits.toArray();
      const completions = await db.habitCompletions.toArray();

      doc.text(`Estatisticas Resumidas:`, 14, 60);
      doc.text(`- Metas Concluidas: ${completedGoals} / ${goals.length}`, 14, 68);
      doc.text(`- Habitos Registrados: ${habits.length}`, 14, 76);
      doc.text(`- Conclusoes de Habitos: ${completions.length}`, 14, 84);

      if (goals.length > 0) {
        doc.setFontSize(14);
        doc.text('Suas Metas', 14, 100);
        const goalData = goals.map(g => [
          g.title, 
          g.category, 
          g.achievedAt ? 'Concluida' : 'Em Progresso'
        ]);
        doc.autoTable({
          startY: 105,
          head: [['Meta', 'Categoria', 'Status']],
          body: goalData,
        });
      }

      doc.save(`LifeQuest_Relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Erro ao exportar', message: 'Não foi possível gerar o PDF. Tente novamente.', icon: '❌', type: 'danger' });
    }
  }
</script>

<main class="min-h-screen p-5 pb-28 max-w-md mx-auto flex flex-col bg-gradient-to-br from-[#140b2e] via-[#0a0a0c] to-[#050505]">
  


  {#if $player}
    <!-- Avatar e Info (Lado a Lado) -->
    <div class="flex items-center gap-5 mb-8 mt-6">
      <!-- Avatar -->
      <div class="relative shrink-0">
        <label class="block w-[100px] h-[100px] rounded-full border-2 border-[#9333EA] overflow-hidden cursor-pointer bg-[#0a0a0c] flex items-center justify-center text-5xl transition-transform hover:scale-105">
          {#if $player?.avatar}
             {#if $player.avatar.startsWith('data:image')}
               <img src={$player.avatar} alt="Avatar" class="w-full h-full object-cover" />
             {:else}
               <span class="text-4xl text-[#9333EA]">{$player.avatar}</span>
             {/if}
          {:else}
             <svg class="w-12 h-12 text-[#9333EA]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          {/if}
          <input type="file" accept="image/*" class="hidden" on:change={handleImageUpload} />
        </label>
        
        <!-- Botão Câmera -->
        <label class="absolute bottom-0 right-0 bg-[#0a0a0c] border border-white/20 text-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors shadow-lg">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <input type="file" accept="image/*" class="hidden" on:change={handleImageUpload} />
        </label>
      </div>

      <!-- Info -->
      <div class="flex-1 flex flex-col">
        <div class="flex items-center gap-2 mb-2 cursor-pointer group" on:click={handleEditProfile}>
          <h2 class="text-white text-[22px] font-black tracking-tight truncate">{$player.name || 'Aventureiro'}</h2>
          <svg class="w-3.5 h-3.5 text-white/30 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </div>
        
        <div class="mb-4">
           <span class="bg-[#1C1C22]/80 text-[#c084fc] text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-[#a855f7]/30 inline-block">
             NÍVEL {$player.level} • INICIANTE
           </span>
        </div>

        <!-- Barra de Progresso -->
        <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4">
          <div class="flex justify-between items-end mb-2">
            <span class="text-[10px] text-white/90 font-medium">Próximo Nível</span>
            <span class="text-[9px] text-white/50"><span class="text-[#c084fc] font-bold">{$player.xp}</span> / {nextLevelXp} XP</span>
          </div>
          <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
             <div class="h-full bg-gradient-to-r from-[#9333EA] to-[#c084fc] rounded-full" style="width: {progressPercent}%"></div>
          </div>
          <p class="text-[9px] text-white/50 text-center"><span class="font-bold text-[#c084fc]">{progressPercent}%</span> concluído</p>
        </div>
      </div>
    </div>

    <!-- Estatísticas em Grid 3x2 -->
    <div class="grid grid-cols-3 gap-3 mb-10">
       <!-- Metas -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square">
          <div class="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-white leading-none mb-1">{$completedGoalsCount || 0}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">Metas</p>
             <p class="text-[9px] text-white/40 leading-tight">concluídas</p>
          </div>
       </div>
       
       <!-- Hábitos -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square">
          <div class="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-white leading-none mb-1">{$completedHabitsCount || 0}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">Hábitos</p>
             <p class="text-[9px] text-white/40 leading-tight">concluídos</p>
          </div>
       </div>
       
       <!-- LifeCoins -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square cursor-pointer hover:bg-white/5 transition-colors group" on:click={() => navigate('quests', { tab: 'loja' })}>
          <div class="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center text-[16px] mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">
             🪙
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-yellow-500 leading-none mb-1">{$player?.coins || 0}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">LifeCoins</p>
             <p class="text-[9px] text-white/40 leading-tight">disponíveis</p>
          </div>
       </div>

       <!-- Pro Coins -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square cursor-pointer hover:bg-white/5 transition-colors group" on:click={() => navigate('quests', { tab: 'loja' })}>
          <div class="w-7 h-7 rounded-full bg-[#9333EA]/10 flex items-center justify-center text-[16px] mb-2 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
             💎
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-[#a855f7] leading-none mb-1">{$player?.proCoins || 0}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">Pro Coins</p>
             <p class="text-[9px] text-white/40 leading-tight">premium</p>
          </div>
       </div>
       
       <!-- Treinos -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square">
          <div class="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10v4"/><path d="M18 10v4"/><path d="M2 12h20"/><path d="M2 9v6"/><path d="M22 9v6"/></svg>
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-white leading-none mb-1">{$completedWorkoutsCount || 0}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">Treinos</p>
             <p class="text-[9px] text-white/40 leading-tight">registrados</p>
          </div>
       </div>
       
       <!-- Carga Total -->
       <div class="bg-[#1C1C22]/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between aspect-square">
          <div class="w-7 h-7 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-2">
             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
          </div>
          <div class="flex flex-col mt-auto">
             <p class="text-2xl font-black text-white leading-none mb-1 truncate w-full">{($volumeTotal || 0) > 1000 ? (($volumeTotal || 0)/1000).toFixed(1) + ' t' : Math.round($volumeTotal || 0) + ' kg'}</p>
             <p class="text-[9px] text-white/70 uppercase tracking-widest font-bold leading-tight">Carga Total</p>
             <p class="text-[9px] text-white/40 leading-tight">levantada</p>
          </div>
       </div>
    </div>
  {/if}

  <!-- PRO BANNER -->
  <div class="relative bg-gradient-to-r from-[#1C1C22] to-[#2D1B4E] border border-[#a855f7]/40 rounded-[20px] p-5 mb-8 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.15)] group cursor-pointer" on:click={showProBenefits}>
    <div class="absolute -right-4 -top-4 w-24 h-24 bg-[#a855f7]/20 rounded-full blur-2xl pointer-events-none group-hover:bg-[#a855f7]/40 transition-colors"></div>
    <div class="relative z-10 flex items-center justify-between">
      <div class="flex-1 pr-4">
        <div class="flex items-center gap-2 mb-1.5">
          <svg class="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          <span class="text-[12px] font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 uppercase tracking-widest">LifeQuest PRO</span>
        </div>
        <p class="text-[11px] text-white/70 leading-snug">Desbloqueie treinos de I.A., métricas avançadas e temas exclusivos.</p>
      </div>
      <button class="shrink-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-[11px] px-4 py-2 rounded-full uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-105 transition-transform">
        Conhecer
      </button>
    </div>
  </div>

  <!-- Configurações e Ferramentas -->
  <h3 class="text-[10px] font-black text-white/40 mb-3 uppercase tracking-widest">Configurações e Ferramentas</h3>
  <div class="bg-[#1C1C22]/40 border border-white/5 rounded-[16px] flex flex-col overflow-hidden mb-8">
     
     <button class="flex items-center gap-4 w-full px-5 py-4 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={showPrivacyNote}>
        <svg class="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div class="text-left flex-1">
           <span class="text-[13px] font-bold text-white/90 block mb-0.5">Privacidade e Segurança</span>
           <span class="text-[10px] text-white/40 block">Gerencie seus dados e privacidade</span>
        </div>
        <span class="text-white/20 text-sm">›</span>
     </button>
     
     <button class="flex items-center gap-4 w-full px-5 py-4 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={showBackupNote}>
        <svg class="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
        <div class="text-left flex-1">
           <span class="text-[13px] font-bold text-white/90 block mb-0.5">Backup LocalFirst</span>
           <span class="text-[10px] text-white/40 block">Sincronize seus dados com a nuvem</span>
        </div>
        <span class="text-white/20 text-sm">›</span>
     </button>
     
     <button class="flex items-center gap-4 w-full px-5 py-4 group hover:bg-white/5 transition-colors border-b border-white/5" on:click={exportData}>
        <svg class="w-5 h-5 text-fuchsia-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        <div class="text-left flex-1">
           <span class="text-[13px] font-bold text-white/90 block mb-0.5">Exportar Relatório PDF</span>
           <span class="text-[10px] text-white/40 block">Gere um relatório completo da sua jornada</span>
        </div>
        <span class="text-white/20 text-sm">›</span>
     </button>
     
     <button class="flex items-center gap-4 w-full px-5 py-4 group hover:bg-white/5 transition-colors" on:click={() => window.location.href = 'mailto:leosergio.583@gmail.com'}>
        <svg class="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        <div class="text-left flex-1">
           <span class="text-[13px] font-bold text-white/90 block mb-0.5">Central de Ajuda</span>
           <span class="text-[10px] text-white/40 block">Tire dúvidas e fale com o suporte</span>
        </div>
        <span class="text-white/20 text-sm">›</span>
     </button>
  </div>
  
  <!-- Sessão da Conta -->
  <h3 class="text-[10px] font-black text-white/40 mb-3 uppercase tracking-widest">Sessão da Conta</h3>
  <div class="bg-[#1C1C22]/40 border border-white/5 rounded-[16px] flex flex-col overflow-hidden">
     <button class="flex items-center gap-4 w-full px-5 py-4 group hover:bg-red-500/5 transition-colors" on:click={handleSoftLogout}>
        <svg class="w-5 h-5 text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span class="text-[13px] font-bold text-[#f43f5e] flex-1 text-left">Desconectar da Nuvem</span>
        <span class="text-white/20 text-sm">›</span>
     </button>
  </div>
</main>
