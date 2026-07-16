<script>
  let mode = 'login'; // 'login' | 'register'
  
  let username = '';
  let email = '';
  let password = '';
  
  let isLoading = false;
  
  // Por enquanto, apenas um mock para fingir que logou
  let isLoggedIn = false; 

  async function handleSubmit() {
    if (!email || !password || (mode === 'register' && !username)) return;
    
    isLoading = true;
    
    // Simula tempo de rede
    await new Promise(r => setTimeout(r, 1200));
    
    // Aqui no futuro chamaremos authService.login() ou .register()
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
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  
  {#if !isLoggedIn}
    <div class="mt-8 mb-8 text-center">
      <div class="w-16 h-16 bg-primary/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
        <span class="text-3xl">☁️</span>
      </div>
      <h1 class="text-2xl font-bold text-white mb-2">
        {mode === 'login' ? 'Bem-vindo de volta!' : 'Proteja seu progresso'}
      </h1>
      <p class="text-sm text-white/60 px-4">
        Crie uma conta para fazer backup dos seus hábitos e participar do ranking de guildas.
      </p>
    </div>

    <!-- Toggle de Abas Lindo -->
    <div class="flex bg-surface rounded-xl p-1 mb-8 text-sm max-w-xs mx-auto">
      <button
        class="flex-1 py-2.5 rounded-lg font-medium transition-all {mode === 'login' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/70'}"
        on:click={() => (mode = 'login')}
      >
        Entrar
      </button>
      <button
        class="flex-1 py-2.5 rounded-lg font-medium transition-all {mode === 'register' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/70'}"
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
          <input
            id="username"
            type="text"
            required
            class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            placeholder="Ex: GuerreiroDaRotina"
            bind:value={username}
          />
        </div>
      {/if}

      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-xs font-medium text-white/60 ml-1">E-mail</label>
        <input
          id="email"
          type="email"
          required
          class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          placeholder="seu@email.com"
          bind:value={email}
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-xs font-medium text-white/60 ml-1">Senha</label>
        <input
          id="password"
          type="password"
          required
          class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          placeholder="••••••••"
          bind:value={password}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="mt-4 bg-primary text-white rounded-xl py-4 font-semibold text-sm shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        {#if isLoading}
          <span class="animate-pulse">Conectando...</span>
        {:else}
          {mode === 'login' ? 'Entrar' : 'Criar Conta'}
        {/if}
      </button>
    </form>

  {:else}
    <!-- TELA QUANDO LOGADO (Sincronização) -->
    <div class="flex justify-between items-start mb-8 mt-4">
      <div>
        <h1 class="text-2xl font-bold text-primary">Perfil</h1>
        <p class="text-sm text-white/60">Seus dados estão protegidos.</p>
      </div>
      <div class="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-xl">
        {email[0].toUpperCase()}
      </div>
    </div>

    <div class="bg-surface rounded-xl p-5 mb-4 border border-white/5 relative overflow-hidden">
      <!-- Brilho sutil de fundo -->
      <div class="absolute top-0 right-0 w-32 h-32 bg-xp/10 blur-3xl rounded-full"></div>
      
      <div class="flex items-center gap-3 mb-4">
        <div class="text-2xl">☁️</div>
        <div>
          <h3 class="font-semibold text-sm">Sincronização na Nuvem</h3>
          <p class="text-xs text-white/40">Última sincronização: Agora mesmo</p>
        </div>
      </div>
      
      <button class="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-3 text-sm font-medium transition-colors">
        Sincronizar Agora
      </button>
    </div>
    
    <div class="bg-surface rounded-xl p-5 mb-8 border border-white/5 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full"></div>
      
      <div class="flex items-center gap-3 mb-4">
        <div class="text-2xl">🏆</div>
        <div>
          <h3 class="font-semibold text-sm">Ranking Social</h3>
          <p class="text-xs text-white/40">Veja sua posição global.</p>
        </div>
      </div>
      
      <button disabled class="w-full bg-primary/20 text-primary/50 border border-primary/20 rounded-lg py-3 text-sm font-medium cursor-not-allowed">
        Em breve...
      </button>
    </div>

    <button on:click={logout} class="w-full text-danger/80 text-sm py-4">
      Sair da conta
    </button>
  {/if}

</main>
