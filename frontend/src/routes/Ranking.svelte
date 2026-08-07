<script>
  import { onMount } from 'svelte';
  import {
    fetchGlobalRanking,
    fetchFriendsRanking,
    fetchFriendRequests,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    fetchRankingVisibility,
    setRankingVisibility
  } from '../services/socialService.js';
  import { showAlert, showConfirm } from '../lib/modal.js';
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { isPro, showProBenefits } from '../lib/pro.js';

  const player = liveQuery(() => db.player.toCollection().first());

  // ── State ──────────────────────────────────────────────────
  let tab = 'global'; // 'global' | 'friends'
  let ranking = [];
  let status = 'loading'; // 'loading' | 'done' | 'error'
  let lastUpdated = null;
  let rankingConsentStatus = 'loading'; // 'loading' | 'prompt' | 'granted' | 'denied'

  $: userIsPro = $player ? isPro($player) : false;

  // Busca de amigos
  let searchQuery = '';
  let searchResults = [];
  let searchStatus = 'idle'; // 'idle' | 'loading' | 'done' | 'error'
  let searchTimeout;

  // Solicitações pendentes
  let pendingRequests = [];

  // ── Loaders ────────────────────────────────────────────────
  async function loadRanking() {
    status = 'loading';
    try {
      ranking = tab === 'global'
        ? await fetchGlobalRanking()
        : await fetchFriendsRanking();
      lastUpdated = new Date();
      status = 'done';
    } catch (e) {
      console.error('[Ranking]', e);
      status = 'error';
    }
  }

  async function loadPendingRequests() {
    try {
      pendingRequests = await fetchFriendRequests();
    } catch {
      pendingRequests = [];
    }
  }

  onMount(async () => {
    try {
      const res = await fetchRankingVisibility();
      if (res.visible === null) {
        rankingConsentStatus = 'prompt';
        status = 'done';
      } else if (res.visible === false) {
        rankingConsentStatus = 'denied';
        status = 'done';
      } else {
        rankingConsentStatus = 'granted';
        loadRanking();
        loadPendingRequests();
      }
    } catch(e) {
      status = 'error';
    }
  });

  async function handleConsentChoice(choice) {
    status = 'loading';
    try {
      await setRankingVisibility(choice);
      if (choice) {
        rankingConsentStatus = 'granted';
        await loadRanking();
        loadPendingRequests();
      } else {
        rankingConsentStatus = 'denied';
        status = 'done';
      }
    } catch(e) {
      status = 'error';
    }
  }

  // Recarrega quando muda de tab
  function switchTab(newTab) {
    tab = newTab;
    ranking = [];
    loadRanking();
  }

  // ── Busca de usuários ──────────────────────────────────────
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    if (searchQuery.trim().length < 2) {
      searchResults = [];
      searchStatus = 'idle';
      return;
    }
    searchStatus = 'loading';
    searchTimeout = setTimeout(async () => {
      try {
        searchResults = await searchUsers(searchQuery.trim());
        searchStatus = 'done';
      } catch {
        searchStatus = 'error';
        searchResults = [];
      }
    }, 400);
  }

  // ── Ações de amizade ──────────────────────────────────────
  async function handleSendRequest(entry) {
    try {
      await sendFriendRequest(entry.username);
      // Atualiza status local sem recarregar tudo
      entry.friendship_status = 'pending_sent';
      searchResults = [...searchResults];
      ranking = ranking.map(r => r.user_id === entry.user_id ? { ...r, friendship_status: 'pending_sent' } : r);
      showAlert({ title: 'Solicitação enviada!', message: `Aguardando ${entry.username} aceitar.`, icon: '✉️', type: 'success', confirmText: 'OK' });
    } catch (e) {
      showAlert({ title: 'Erro', message: e.message ?? 'Não foi possível enviar a solicitação.', icon: '⚠️', type: 'warning', confirmText: 'OK' });
    }
  }

  async function handleAccept(req) {
    try {
      await acceptFriendRequest(req.id);
      pendingRequests = pendingRequests.filter(r => r.id !== req.id);
      await loadRanking(); // Recarrega ranking de amigos
      showAlert({ title: 'Amizade aceita!', message: `${req.username} agora é seu amigo.`, icon: '🤝', type: 'success', confirmText: 'Boa!' });
    } catch (e) {
      showAlert({ title: 'Erro', message: e.message, icon: '⚠️', type: 'warning', confirmText: 'OK' });
    }
  }

  async function handleReject(req) {
    const ok = await showConfirm({
      title: 'Recusar solicitação?',
      message: `Recusar pedido de ${req.username}?`,
      icon: '🚫',
      type: 'danger',
      confirmText: 'Recusar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    try {
      await removeFriend(req.id);
      pendingRequests = pendingRequests.filter(r => r.id !== req.id);
    } catch (e) {
      showAlert({ title: 'Erro', message: e.message, icon: '⚠️', type: 'warning', confirmText: 'OK' });
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  function xpLabel(xp) {
    if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
    if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}k`;
    return String(xp);
  }

  function timeAgo(date) {
    if (!date) return '';
    const secs = Math.floor((new Date() - date) / 1000);
    if (secs < 60) return 'agora mesmo';
    if (secs < 3600) return `há ${Math.floor(secs / 60)} min`;
    return `há ${Math.floor(secs / 3600)}h`;
  }

  // Status label + cor do botão "Adicionar"
  function friendBtnState(entry) {
    if (entry.is_me) return null;
    switch (entry.friendship_status) {
      case 'accepted':       return { label: '✓ Amigo',    cls: 'bg-green-500/20 text-green-400 border-green-500/30',  disabled: true  };
      case 'pending_sent':   return { label: '⏳ Enviado', cls: 'bg-white/5 text-white/40 border-white/10',            disabled: true  };
      case 'pending_received': return { label: '✋ Aceitar', cls: 'bg-[#9333EA]/20 text-[#a855f7] border-[#a855f7]/30', disabled: false };
      default:               return { label: '+ Adicionar', cls: 'bg-white/5 text-white/70 border-white/10 hover:bg-[#9333EA]/20 hover:text-[#a855f7] hover:border-[#a855f7]/30', disabled: false };
    }
  }

  $: showSearch = tab === 'global';
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">

  {#if rankingConsentStatus === 'loading'}
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div class="w-8 h-8 border-[3px] border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
      <p class="text-[13px] text-white/40">Carregando preferências...</p>
    </div>
  {:else if rankingConsentStatus === 'prompt'}
    <div class="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div class="w-20 h-20 bg-[#9333EA]/20 rounded-full flex items-center justify-center mb-6 border border-[#a855f7]/30">
        <span class="text-4xl">🌍</span>
      </div>
      <h2 class="text-2xl font-black text-white mb-2">Entrar no Ranking?</h2>
      <p class="text-[13px] text-white/50 mb-8 leading-relaxed">
        Para ver o Ranking Global e seus amigos (caso seja Premium), você precisará exibir o seu perfil publicamente.<br><br>
        Você topa o desafio?
      </p>
      <div class="flex gap-4 w-full max-w-[280px]">
        <button class="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-bold text-sm hover:bg-white/10 transition-colors" on:click={() => handleConsentChoice(false)}>
          Não, obrigado
        </button>
        <button class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#9333EA] to-[#c084fc] text-white font-black text-sm shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-105 transition-all" on:click={() => handleConsentChoice(true)}>
          Sim, bora!
        </button>
      </div>
    </div>
  {:else if rankingConsentStatus === 'denied'}
    <div class="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <span class="text-5xl opacity-40 mb-4">👻</span>
      <h2 class="text-xl font-black text-white mb-2">Modo Fantasma</h2>
      <p class="text-[13px] text-white/50 mb-6 leading-relaxed max-w-[280px]">
        Você optou por não participar do ranking. Seus dados estão ocultos e você não pode ver os outros jogadores.
      </p>
      <button class="px-6 py-3 rounded-2xl bg-[#9333EA]/20 border border-[#a855f7]/30 text-[#a855f7] font-bold text-sm hover:bg-[#9333EA]/40 transition-colors" on:click={() => handleConsentChoice(true)}>
        Mudei de ideia, participar
      </button>
    </div>
  {:else}

  <!-- Cabeçalho -->
  <div class="flex justify-between items-start mb-6 mt-4">
    <div>
      <h1 class="text-3xl font-black text-white tracking-tight mb-1">Ranking</h1>
      <p class="text-[13px] text-white/50">Compare-se com o mundo e seus amigos.</p>
    </div>
    <div class="flex gap-2">
      <button
        class="w-10 h-10 bg-white/5 border border-white/10 rounded-[12px] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        on:click={() => handleConsentChoice(false)}
        title="Sair do Ranking (Modo Fantasma)"
      >
        👻
      </button>
      <button
        class="w-10 h-10 bg-white/5 border border-white/10 rounded-[12px] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
        on:click={loadRanking}
        disabled={status === 'loading'}
        title="Atualizar ranking"
      >
        <svg class="w-4 h-4 {status === 'loading' ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-2 mb-5">
    <button
      class="flex-1 py-2.5 rounded-full font-bold text-[12px] transition-all {tab === 'global' ? 'bg-[#9333EA] text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}"
      on:click={() => switchTab('global')}
    >
      🌍 Global
    </button>
    
    {#if userIsPro}
      <button
        class="flex-1 py-2.5 rounded-full font-bold text-[12px] transition-all {tab === 'friends' ? 'bg-[#9333EA] text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'} relative"
        on:click={() => switchTab('friends')}
      >
        👥 Amigos
        {#if pendingRequests.length > 0}
          <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
            {pendingRequests.length}
          </span>
        {/if}
      </button>
    {:else}
      <button
        class="flex-1 py-2.5 rounded-full font-bold text-[12px] bg-white/5 border border-white/10 text-white/30 cursor-pointer relative overflow-hidden"
        on:click={showProBenefits}
      >
        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]">🔒</span>
        👥 Amigos
      </button>
    {/if}
  </div>

  <!-- ──────────────────── Tab: Amigos ──────────────────── -->
  {#if tab === 'friends'}

    <!-- Solicitações pendentes -->
    {#if pendingRequests.length > 0}
      <div class="mb-4">
        <p class="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
          Solicitações recebidas ({pendingRequests.length})
        </p>
        <div class="flex flex-col gap-2">
          {#each pendingRequests as req (req.id)}
            <div class="bg-[#1C1C22]/80 border border-[#a855f7]/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div class="w-10 h-10 rounded-full border border-[#a855f7]/30 bg-surface flex items-center justify-center text-lg shrink-0">
                {#if req.avatar?.startsWith('data:image')}
                  <img src={req.avatar} alt={req.username} class="w-full h-full object-cover rounded-full" />
                {:else}
                  <span>{req.avatar || '👤'}</span>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-[13px] text-white">{req.username}</p>
                <p class="text-[10px] text-white/40">Nível {req.level} quer ser seu amigo</p>
              </div>
              <div class="flex gap-1.5 shrink-0">
                <button
                  class="bg-[#9333EA]/20 border border-[#a855f7]/30 text-[#a855f7] text-[10px] font-bold px-3 py-1.5 rounded-[10px] hover:bg-[#9333EA]/40 transition-colors"
                  on:click={() => handleAccept(req)}
                >✓</button>
                <button
                  class="bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold px-3 py-1.5 rounded-[10px] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  on:click={() => handleReject(req)}
                >✕</button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Busca para adicionar amigos -->
    <div class="mb-5">
      <p class="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Adicionar amigo</p>
      <div class="relative">
        <input
          type="text"
          placeholder="Buscar por @username..."
          class="w-full bg-[#1C1C22]/80 border border-white/10 rounded-[14px] px-4 py-3 text-[13px] text-white placeholder:text-white/30 focus:border-[#a855f7]/50 focus:outline-none transition-colors"
          bind:value={searchQuery}
          on:input={handleSearchInput}
        />
        {#if searchStatus === 'loading'}
          <div class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
        {/if}
      </div>

      {#if searchStatus === 'done' && searchResults.length > 0}
        <div class="mt-2 flex flex-col gap-2">
          {#each searchResults as entry (entry.user_id)}
            {@const btn = friendBtnState(entry)}
            <div class="bg-[#1C1C22]/80 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div class="w-9 h-9 rounded-full border border-white/10 bg-surface flex items-center justify-center text-base shrink-0">
                {#if entry.avatar?.startsWith('data:image')}
                  <img src={entry.avatar} alt={entry.username} class="w-full h-full object-cover rounded-full" />
                {:else}
                  <span>{entry.avatar || '👤'}</span>
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-[12px] text-white">{entry.username}</p>
                <p class="text-[9px] text-white/40">Nível {entry.level} · 🔥 {entry.streak_days}d</p>
              </div>
              {#if btn}
                <button
                  class="text-[10px] font-bold px-3 py-1.5 rounded-[10px] border transition-colors shrink-0 {btn.cls}"
                  disabled={btn.disabled}
                  on:click={() => btn.disabled ? null : (entry.friendship_status === 'pending_received' ? handleAccept({ id: entry.user_id, username: entry.username, level: entry.level }) : handleSendRequest(entry))}
                >
                  {btn.label}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {:else if searchStatus === 'done' && searchQuery.length >= 2}
        <p class="text-[11px] text-white/30 mt-2 text-center">Nenhum usuário encontrado para "{searchQuery}"</p>
      {/if}
    </div>

  {/if}

  <!-- ──────────────────── Lista de Ranking ──────────────────── -->
  {#if status === 'loading'}
    <div class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="w-8 h-8 border-[3px] border-[#a855f7] border-t-transparent rounded-full animate-spin"></div>
      <p class="text-[13px] text-white/40">Carregando {tab === 'global' ? 'ranking global' : 'ranking de amigos'}...</p>
    </div>

  {:else if status === 'error'}
    <div class="flex flex-col items-center justify-center py-16 text-center gap-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
      <span class="text-4xl">⚠️</span>
      <div>
        <p class="text-white font-bold mb-1">Não foi possível carregar</p>
        <p class="text-[13px] text-white/50">Verifique sua conexão e tente novamente.</p>
      </div>
      <button class="bg-white/10 border border-white/10 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-white/15 transition-colors" on:click={loadRanking}>
        Tentar novamente
      </button>
    </div>

  {:else if ranking.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
      {#if tab === 'friends'}
        <span class="text-5xl opacity-30">👥</span>
        <p class="text-white font-bold">Nenhum amigo ainda</p>
        <p class="text-white/40 text-sm">Busque por @username acima para adicionar amigos e ver o ranking deles aqui.</p>
      {:else}
        <span class="text-5xl opacity-30">🏆</span>
        <p class="text-white/50 text-sm">Nenhum jogador registrado ainda.</p>
      {/if}
    </div>

  {:else}
    <!-- Pódio top 3 -->
    {#if ranking.length >= 3}
      <div class="flex items-end justify-center gap-3 mb-6 px-2">
        {#each [1, 0, 2] as idx}
          {@const entry = ranking[idx]}
          {@const btn = friendBtnState(entry)}
          {@const medals = ['🥇','🥈','🥉']}
          {@const borders = ['border-yellow-400','border-slate-400','border-orange-700']}
          {@const glows = [
            'shadow-[0_0_25px_rgba(234,179,8,0.4)]',
            'shadow-[0_0_15px_rgba(148,163,184,0.3)]',
            'shadow-[0_0_15px_rgba(180,83,9,0.3)]'
          ]}
          {@const bgCards = [
            'bg-yellow-500/10 border-yellow-500/30',
            'bg-slate-400/10 border-slate-400/30',
            'bg-orange-800/10 border-orange-700/30'
          ]}
          {@const xpColors = ['text-yellow-400','text-slate-300','text-orange-400']}
          {@const sizes  = [idx === 0 ? 'w-[70px] h-[70px]' : 'w-14 h-14']}
          {@const offset = idx === 0 ? '-mt-4' : ''}

          <div class="flex flex-col items-center gap-2 flex-1 {offset}">
            <!-- Avatar -->
            <div class="relative">
              <div class="{sizes[0]} rounded-full overflow-hidden border-[3px] {borders[idx]} bg-surface flex items-center justify-center text-2xl {glows[idx]} {entry.is_me ? 'ring-2 ring-[#a855f7] ring-offset-2 ring-offset-[#0f0f14]' : ''}">
                {#if entry.avatar?.startsWith('data:image')}
                  <img src={entry.avatar} alt={entry.username} class="w-full h-full object-cover" />
                {:else}
                  <span>{entry.avatar || '👤'}</span>
                {/if}
              </div>
              {#if idx === 0}
                <span class="absolute -top-3 left-1/2 -translate-x-1/2 text-xl drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">👑</span>
              {/if}
            </div>

            <!-- Card -->
            <div class="border rounded-2xl p-3 w-full text-center shadow-inner {bgCards[idx]}">
              <p class="{xpColors[idx]} text-xl font-black">{medals[idx]}</p>
              <p class="text-white font-bold text-[11px] truncate mt-1">{entry.username}</p>
              <p class="text-[9px] text-white/40 mt-0.5">Nível {entry.level}</p>
              <p class="{xpColors[idx]} font-black text-[11px] mt-1">{xpLabel(entry.xp)} XP</p>
              {#if btn && !btn.disabled}
                <button
                  class="mt-2 w-full text-[9px] font-bold py-1 rounded-lg border transition-colors {btn.cls}"
                  on:click={() => handleSendRequest(entry)}
                >{btn.label}</button>
              {:else if btn}
                <span class="mt-2 block text-[9px] font-bold text-white/30">{btn.label}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}


    <!-- Lista a partir do 4º -->
    <div class="flex flex-col gap-2">
      {#each ranking.slice(3) as entry (entry.user_id)}
        {@const btn = friendBtnState(entry)}
        <div class="bg-[#1C1C22]/80 border {entry.is_me ? 'border-[#a855f7]/50 shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'border-white/5'} rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden transition-all">
          {#if entry.is_me}<div class="absolute inset-0 bg-[#a855f7]/5 pointer-events-none"></div>{/if}

          <span class="text-[13px] font-black text-white/40 w-7 text-center shrink-0 relative z-10">{entry.rank}</span>

          <div class="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-surface flex items-center justify-center text-lg shrink-0 relative z-10">
            {#if entry.avatar?.startsWith('data:image')}<img src={entry.avatar} alt={entry.username} class="w-full h-full object-cover" />{:else}<span>{entry.avatar || '👤'}</span>{/if}
          </div>

          <div class="flex-1 min-w-0 relative z-10">
            <div class="flex items-center gap-2">
              <p class="font-bold text-[13px] text-white truncate">{entry.username}</p>
              {#if entry.is_me}<span class="text-[9px] font-black text-[#a855f7] bg-[#a855f7]/15 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">Você</span>{/if}
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[10px] text-[#a855f7] font-bold">Nível {entry.level}</span>
              <span class="text-white/20 text-[10px]">·</span>
              <span class="text-[10px] text-white/40">🔥 {entry.streak_days}d</span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0 relative z-10">
            <div class="text-right">
              <p class="text-[13px] font-black text-white">{xpLabel(entry.xp)}</p>
              <p class="text-[9px] text-white/30 uppercase tracking-wider">XP</p>
            </div>
            {#if btn}
              <button
                class="text-[10px] font-bold px-2.5 py-1.5 rounded-[10px] border transition-colors {btn.cls} {btn.disabled ? 'cursor-default' : ''}"
                disabled={btn.disabled}
                on:click={() => !btn.disabled && handleSendRequest(entry)}
                title={btn.label}
              >
                {entry.friendship_status === 'accepted' ? '✓' : entry.friendship_status === 'pending_sent' ? '⏳' : '+'}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Timestamp -->
    {#if lastUpdated}
      <p class="text-center text-[10px] text-white/20 mt-5">Atualizado {timeAgo(lastUpdated)}</p>
    {/if}
  {/if}
  {/if}

</main>
