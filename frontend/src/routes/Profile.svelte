<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import StatsBar from '../components/StatsBar.svelte';

  import { ACHIEVEMENTS } from '../lib/achievements.js';

  const player = liveQuery(() => db.player.toCollection().first());
  const inventory = liveQuery(() => db.inventory.toArray());
  const unlockedAchievements = liveQuery(async () => {
    const list = await db.unlockedAchievements.toArray();
    return new Set(list.map(a => a.achievementId));
  });

  $: myMedals = ACHIEVEMENTS.filter(a => $unlockedAchievements?.has(a.id));

  $: boughtAvatars = $inventory ? $inventory.filter(i => i.category === 'avatar') : [];

  let mode = 'login'; // 'login' | 'register'
  let username = '';
  let email = '';
  let password = '';
  let isLoading = false;
  let isLoggedIn = false; 
  let showAvatarModal = false;

  async function handleSubmit() {
    if (!email || !password || (mode === 'register' && !username)) return;
    isLoading = true;
    await new Promise(r => setTimeout(r, 1200));
    isLoggedIn = true;
    isLoading = false;
  }
  
  function toggleMode() {
    mode = mode === 'login' ? 'register' : 'login';
    password = '';
  }
  
  function logout() {
    isLoggedIn = false;
    email = '';
    password = '';
    username = '';
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      if ($player) {
        await db.player.update($player.id, { avatar: base64 });
      }
      showAvatarModal = false;
    };
    reader.readAsDataURL(file);
  }

  async function selectAvatarIcon(itemId) {
    if (!$player) return;
    // Pega o ícone do item comprado (ex: dragão, ninja)
    // Para simplificar, vou mapear o ID pro ícone aqui, ou podíamos ter salvo o ícone no inventory.
    const iconMap = {
      'avatar_dragon': '🐲',
      'avatar_ninja': '🥷'
    };
    const icon = iconMap[itemId] || '👤';
    await db.player.update($player.id, { avatar: icon });
    showAvatarModal = false;
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto flex flex-col gap-6">
  
  <!-- CABEÇALHO DO PERFIL (Sempre Visível) -->
  <div class="flex justify-between items-center mt-2">
    <div>
      <h1 class="text-2xl font-bold text-primary">Perfil do Herói</h1>
      <p class="text-sm text-white/60">Sua jornada e estatísticas.</p>
    </div>
    
    <button 
      class="w-16 h-16 bg-surface border border-white/10 text-primary rounded-full flex items-center justify-center font-bold text-3xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors"
      on:click={() => showAvatarModal = true}
    >
      {#if $player?.avatar}
         {#if $player.avatar.startsWith('data:image')}
           <img src={$player.avatar} alt="Avatar" class="w-full h-full object-cover" />
         {:else}
           <span>{$player.avatar}</span>
         {/if}
      {:else}
         <span>👤</span>
      {/if}
      <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span class="text-white text-xs">Editar</span>
      </div>
    </button>
  </div>

  {#if player}
    <div class="mb-2">
      <StatsBar level={$player?.level ?? 1} xp={$player?.xp ?? 0} streak={$player?.streak ?? 0} coins={$player?.coins ?? 0} />
    </div>
  {/if}

  <!-- Medalhas -->
  {#if myMedals && myMedals.length > 0}
    <div class="mt-2 mb-2 bg-surface/50 rounded-2xl p-4 border border-white/5">
      <h2 class="text-xs uppercase font-bold text-yellow-500/80 mb-3 tracking-wider flex items-center gap-2">
        <span>🏅</span> Suas Conquistas
      </h2>
      <div class="flex overflow-x-auto gap-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {#each myMedals as medal}
          <div class="shrink-0 w-16 flex flex-col items-center gap-2">
            <div class="w-14 h-14 rounded-full border flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(234,179,8,0.2)] {medal.bg}">
              {medal.icon}
            </div>
            <span class="text-[9px] font-bold text-white/80 text-center leading-tight">{medal.name}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="mt-2 mb-2 bg-surface/30 rounded-2xl p-4 border border-white/5 border-dashed flex flex-col items-center justify-center text-center">
      <span class="text-3xl opacity-50 mb-2 filter grayscale">🏅</span>
      <h3 class="text-xs font-bold text-white/50 mb-1">Mural de Medalhas Vazio</h3>
      <p class="text-[10px] text-white/40">Complete desafios e hábitos para ganhar conquistas!</p>
    </div>
  {/if}

  <hr class="border-white/5 my-2" />

  <!-- ÁREA DE LOGIN E NUVEM -->
  {#if !isLoggedIn}
    <div class="text-center mt-2">
      <div class="w-12 h-12 bg-primary/20 rounded-2xl mx-auto flex items-center justify-center mb-3">
        <span class="text-2xl">☁️</span>
      </div>
      <h2 class="text-lg font-bold text-white mb-1">Proteja seu progresso</h2>
      <p class="text-xs text-white/60 px-4 mb-6">Crie uma conta para fazer backup dos seus hábitos e participar do ranking.</p>
    </div>

    <!-- Toggle de Abas -->
    <div class="flex bg-surface rounded-xl p-1 mb-6 text-sm max-w-xs mx-auto">
      <button
        class="flex-1 py-2 rounded-lg font-medium transition-all {mode === 'login' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/70'}"
        on:click={() => (mode = 'login')}
      >
        Entrar
      </button>
      <button
        class="flex-1 py-2 rounded-lg font-medium transition-all {mode === 'register' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/70'}"
        on:click={() => (mode = 'register')}
      >
        Cadastrar
      </button>
    </div>

    <!-- Formulário -->
    <form on:submit|preventDefault={handleSubmit} class="flex flex-col gap-4">
      {#if mode === 'register'}
        <div class="flex flex-col gap-1.5">
          <label for="username" class="text-xs font-medium text-white/60 ml-1">Nome de Herói</label>
          <input id="username" type="text" required class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ex: GuerreiroDaRotina" bind:value={username} />
        </div>
      {/if}

      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-xs font-medium text-white/60 ml-1">E-mail</label>
        <input id="email" type="email" required class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="seu@email.com" bind:value={email} />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-xs font-medium text-white/60 ml-1">Senha</label>
        <input id="password" type="password" required class="bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="••••••••" bind:value={password} />
      </div>

      <button type="submit" disabled={isLoading} class="mt-2 bg-primary text-white rounded-xl py-3 font-bold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
        {#if isLoading}
          <span class="animate-pulse">Conectando...</span>
        {:else}
          {mode === 'login' ? 'Entrar' : 'Criar Conta'}
        {/if}
      </button>
    </form>

  {:else}
    <!-- LOGADO -->
    <div class="bg-surface rounded-xl p-5 border border-white/5 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-xp/10 blur-3xl rounded-full"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="text-2xl">☁️</div>
        <div>
          <h3 class="font-semibold text-sm">Sincronização na Nuvem</h3>
          <p class="text-xs text-white/40">Última sincronização: Agora mesmo</p>
        </div>
      </div>
      <button class="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-3 text-sm font-medium transition-colors">Sincronizar Agora</button>
    </div>
    
    <div class="bg-surface rounded-xl p-5 border border-white/5 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="text-2xl">🏆</div>
        <div>
          <h3 class="font-semibold text-sm">Ranking Social</h3>
          <p class="text-xs text-white/40">Veja sua posição global.</p>
        </div>
      </div>
      <button disabled class="w-full bg-primary/20 text-primary/50 border border-primary/20 rounded-lg py-3 text-sm font-medium cursor-not-allowed">Em breve...</button>
    </div>

    <button on:click={logout} class="w-full text-danger/80 text-sm py-4 font-medium mt-4">Sair da conta</button>
  {/if}
</main>

<!-- MODAL DE AVATAR -->
{#if showAvatarModal}
  <div class="fixed inset-0 bg-bg/90 z-50 flex flex-col justify-end p-4 backdrop-blur-sm animate-fade-in">
    <div class="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm mx-auto shadow-2xl relative mb-20">
      <button class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-white/50" on:click={() => showAvatarModal = false}>✕</button>
      
      <h2 class="text-xl font-bold text-white mb-6">Escolha seu Avatar</h2>

      <div class="mb-6">
        <h3 class="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Foto da Galeria</h3>
        <label class="w-full bg-bg border border-white/10 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <span class="text-2xl">📸</span>
          <span class="text-xs font-medium text-white/70">Fazer upload de foto</span>
          <input type="file" accept="image/*" class="hidden" on:change={handleImageUpload} />
        </label>
      </div>

      <div>
        <h3 class="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Avatares da Taverna</span>
          <span class="text-[9px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">Comprados</span>
        </h3>
        
        {#if boughtAvatars.length > 0}
          <div class="grid grid-cols-4 gap-3">
            {#each boughtAvatars as avatar}
              <button 
                class="bg-bg border border-white/10 rounded-xl aspect-square flex flex-col items-center justify-center text-3xl hover:border-primary/50 hover:bg-primary/10 transition-colors"
                on:click={() => selectAvatarIcon(avatar.itemId)}
              >
                {#if avatar.itemId === 'avatar_dragon'}🐲
                {:else if avatar.itemId === 'avatar_ninja'}🥷
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="bg-bg border border-white/5 rounded-xl p-4 text-center">
            <span class="text-2xl opacity-50 mb-2 block">🏪</span>
            <p class="text-xs text-white/50">Você ainda não comprou avatares na Loja.</p>
          </div>
        {/if}
      </div>

    </div>
  </div>
{/if}
