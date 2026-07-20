<script>
  import { db } from '../db/db.js';
  import { GOALS } from '../lib/constants.js';
  import { api } from '../lib/api.js';

  // Onboarding em 3 passos curtos: nome, objetivo, métricas básicas.
  // Nada de quiz nem chamada de IA — o app funciona 100% offline desde o
  // primeiro segundo. Perimetria detalhada (circunferências etc.) fica
  // pra tela de Métricas, quando o usuário quiser se aprofundar depois.
  let step = 0;
  const totalSteps = 3;

  let name = '';
  let email = '';
  let password = '';
  let authMode = 'login';
  let showPassword = false;
  let rememberMe = true;
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;
  let goal = null;

  let age = '';
  let weight = '';
  let height = '';

  let saving = false;

  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  async function next() {
    errorMessage = '';
    successMessage = '';

    if (step === 1) {
      if (authMode === 'register' && (!name.trim() || !email.trim() || !password)) return;
      if (authMode === 'login' && (!email.trim() || !password)) return;

      isLoading = true;
      try {
        if (authMode === 'register') {
          // Chamada para a API de Registro
          await api.register({ name: name.trim(), email: email.trim(), password });

          // Auto-login após o registro para já salvar o token
          const loginData = await api.login({ email: email.trim(), password });
          localStorage.setItem('access_token', loginData.access_token);

          isLoading = false;
          successMessage = 'Cadastrado com sucesso!';
          setTimeout(() => {
            successMessage = '';
            step += 1;
          }, 1500);
          return;
        } else if (authMode === 'login') {
          // Chamada para a API de Login
          const data = await api.login({ email: email.trim(), password });
          localStorage.setItem('access_token', data.access_token);
          
          // Como ainda não temos uma rota para buscar os dados do usuário sincronizados,
          // simulamos a continuação localmente para o Dashboard
          const rawName = data.name || email.split('@')[0];
          name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          goal = 'health'; // Objetivo mockado provisório
          await finish();
          return;
        }
      } catch (err) {
        errorMessage = 'Erro de conexão com o servidor. Verifique se o backend está rodando.';
        isLoading = false;
        return;
      }
    }

    if (step === 2 && !goal) return;
    step += 1;
  }

  function back() {
    step -= 1;
  }

  async function finish() {
    if (!name.trim() || !goal || saving) return;
    saving = true;

    try {
      await db.player.add({
        name: name.trim(),
        goal,
        level: 1,
        xp: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      });

      // Métricas básicas são opcionais — só grava se pelo menos uma foi
      // preenchida, pra não criar uma medição vazia sem sentido.
      if (age || weight || height) {
        await db.bodyMeasurements.add({
          date: new Date().toISOString().slice(0, 10),
          age: age === '' ? null : Number(age),
          weight: weight === '' ? null : Number(weight),
          height: height === '' ? null : Number(height),
          shoulder: null,
          chest: null,
          abdomen: null,
          thigh: null,
          calf: null,
          armLeft: null,
          armRight: null,
          forearm: null
        });
      }

      // A partir daqui, o App.svelte percebe (via liveQuery) que já existe
      // um player e troca pra tela de Início sozinho.
      await db.habits.bulkAdd(
        starterHabits.map((h) => ({ ...h, archivedAt: null, createdAt: new Date().toISOString() }))
      );
    } finally {
      saving = false;
    }
  }
</script>

<main class="min-h-screen flex flex-col justify-center items-center p-6">
  <div class="w-full max-w-sm flex flex-col items-center gap-5">
    {#if step > 0}
      <div class="flex gap-1.5 mb-2">
        {#each Array(totalSteps) as _, i}
          <span class="w-6 h-1.5 rounded-full {i + 1 <= step ? 'bg-primary' : 'bg-white/10'}"></span>
        {/each}
      </div>
    {/if}

    {#if step === 0}
      <!-- Tela de Apresentação (Intro) -->
      <div class="w-full flex flex-col items-center animate-fade-in mt-4">
        <!-- Logo Icon -->
        <div class="w-20 h-20 rounded-full border border-primary/30 flex items-center justify-center text-4xl mb-4 shadow-[0_0_30px_rgba(124,92,255,0.2)] bg-gradient-to-br from-surface to-bg relative overflow-hidden">
          <div class="absolute inset-0 bg-primary/10"></div>
          <span class="relative z-10">🌟</span>
        </div>
        
        <h1 class="text-3xl font-bold mb-1 tracking-tight text-white">LifeQuest</h1>
        <p class="text-white/50 mb-8 text-sm">Seu aplicativo de desenvolvimento pessoal.</p>
        
        <div class="flex flex-col gap-3 w-full mb-8">
          <!-- Card 1 -->
          <div class="flex items-center gap-4 bg-surface/80 p-4 rounded-2xl border border-white/5 shadow-md relative overflow-hidden">
             <div class="absolute top-0 left-0 w-1 bg-primary h-full"></div>
             <div class="flex flex-col items-center justify-center bg-white/5 rounded-lg w-12 h-12 p-2 shrink-0">
               <span class="text-[10px] font-bold text-white/40 mb-1">01</span>
               <span class="text-xl">📈</span>
             </div>
             <div class="text-left">
               <h3 class="font-semibold text-sm text-white/90"><span class="text-primary">Evolua</span> constantemente</h3>
               <p class="text-[11px] text-white/50 leading-tight mt-0.5">Acompanhe seu progresso e suba de nível completando hábitos reais.</p>
             </div>
          </div>
          
          <!-- Card 2 -->
          <div class="flex items-center gap-4 bg-surface/80 p-4 rounded-2xl border border-white/5 shadow-md relative overflow-hidden">
             <div class="absolute top-0 left-0 w-1 bg-primary h-full"></div>
             <div class="flex flex-col items-center justify-center bg-white/5 rounded-lg w-12 h-12 p-2 shrink-0">
               <span class="text-[10px] font-bold text-white/40 mb-1">02</span>
               <span class="text-xl">💪</span>
             </div>
             <div class="text-left">
               <h3 class="font-semibold text-sm text-white/90"><span class="text-xp">Domine</span> seus Treinos</h3>
               <p class="text-[11px] text-white/50 leading-tight mt-0.5">Monte fichas, acompanhe recordes de carga e veja seus resultados.</p>
             </div>
          </div>
          
          <!-- Card 3 -->
          <div class="flex items-center gap-4 bg-surface/80 p-4 rounded-2xl border border-white/5 shadow-md relative overflow-hidden">
             <div class="absolute top-0 left-0 w-1 bg-primary h-full"></div>
             <div class="flex flex-col items-center justify-center bg-white/5 rounded-lg w-12 h-12 p-2 shrink-0">
               <span class="text-[10px] font-bold text-white/40 mb-1">03</span>
               <span class="text-xl">⚡</span>
             </div>
             <div class="text-left">
               <h3 class="font-semibold text-sm text-white/90"><span class="text-xp">Rápido</span> e Privado</h3>
               <p class="text-[11px] text-white/50 leading-tight mt-0.5">Funciona 100% offline. Sincronize com a nuvem apenas se quiser.</p>
             </div>
          </div>
        </div>

        <button 
          class="w-full bg-primary flex items-center justify-center gap-2 text-white rounded-xl py-4 font-bold shadow-[0_4px_20px_rgba(124,92,255,0.4)] transition-transform active:scale-95 mb-6" 
          on:click={() => step = 1}
        >
          <span>🚀</span>
          <span>Começar Jornada</span>
          <span class="ml-1 opacity-70">›</span>
        </button>

        <!-- Trust Badges (Rodapé) -->
        <div class="w-full flex justify-between items-start pt-4 border-t border-white/5 px-2">
          <div class="flex flex-col items-center text-center gap-1.5 flex-1">
            <span class="text-primary/70 text-base">🛡️</span>
            <span class="text-[9px] text-white/40 leading-tight">Dados são<br>seus</span>
          </div>
          <div class="flex flex-col items-center text-center gap-1.5 flex-1 border-l border-white/5">
            <span class="text-primary/70 text-base">⚡</span>
            <span class="text-[9px] text-white/40 leading-tight">100%<br>offline</span>
          </div>
          <div class="flex flex-col items-center text-center gap-1.5 flex-1 border-l border-white/5">
            <span class="text-primary/70 text-base">👁️</span>
            <span class="text-[9px] text-white/40 leading-tight">Sem anúncios<br>invasivos</span>
          </div>
          <div class="flex flex-col items-center text-center gap-1.5 flex-1 border-l border-white/5">
            <span class="text-primary/70 text-base">🎯</span>
            <span class="text-[9px] text-white/40 leading-tight">Foco no que<br>importa</span>
          </div>
        </div>
      </div>

    {:else if step === 1}
      <div class="w-full flex flex-col items-center animate-fade-in mt-2">
        <!-- Icon -->
        <div class="w-[84px] h-[84px] rounded-full border border-primary/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(124,92,255,0.25)] bg-gradient-to-b from-[#1a172c] to-bg relative overflow-hidden">
          <div class="absolute inset-0 bg-primary/10"></div>
          <!-- Stars/Sparkles -->
          <div class="absolute top-4 left-5 text-[10px] text-white/60">✦</div>
          <div class="absolute top-6 right-6 text-[8px] text-white/80">✦</div>
          <div class="absolute bottom-5 left-7 text-[12px] text-white/50">✦</div>
          <div class="absolute bottom-6 right-5 text-[10px] text-white/40">✦</div>
          <!-- Cloud Icon with Arrow -->
          <div class="relative z-10 flex flex-col items-center justify-center mt-1">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 18H16.5C18.9853 18 21 15.9853 21 13.5C21 11.2336 19.3243 9.35624 17.1352 9.04368C16.4807 5.61715 13.4314 3 9.8 3C6.04446 3 3 6.04446 3 9.8C3 10.1557 3.02737 10.505 3.07973 10.8458C1.30903 11.4429 0 13.136 0 15.15C0 17.6521 2.02944 19.6815 4.53153 19.6815H7.5" fill="white" />
              <path d="M12 18V8M12 8L9 11M12 8L15 11" stroke="#7C5CFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="text-center mb-7">
          <h1 class="text-[28px] font-bold mb-2">Proteja seu <span class="text-primary">progresso</span></h1>
          <p class="text-[14px] text-white/60 leading-relaxed px-4">Faça login para continuar acompanhando seus treinos, hábitos e conquistas.</p>
        </div>

        <!-- Tabs -->
        <div class="w-full flex rounded-xl border border-white/5 bg-surface/50 p-1 mb-6">
          <button 
            type="button"
            class="flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative transition-colors {authMode === 'login' ? 'text-primary' : 'text-white/40 hover:text-white/70'}"
            on:click={() => authMode = 'login'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Entrar
            {#if authMode === 'login'}
              <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[3px] bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(124,92,255,0.5)]"></div>
            {/if}
          </button>
          
          <button 
            type="button"
            class="flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative transition-colors {authMode === 'register' ? 'text-primary' : 'text-white/40 hover:text-white/70'}"
            on:click={() => authMode = 'register'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Cadastrar
            {#if authMode === 'register'}
              <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[3px] bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(124,92,255,0.5)]"></div>
            {/if}
          </button>
        </div>

        <form on:submit|preventDefault={next} class="w-full flex flex-col gap-4 text-left">
          {#if authMode === 'register'}
            <!-- Nome -->
            <div class="relative animate-fade-in">
              <div class="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <input
                class="w-full bg-surface/40 border border-white/5 rounded-xl pl-11 pr-4 py-4 text-sm focus:border-primary focus:bg-surface/80 focus:outline-none transition-all placeholder:text-white/30 text-white"
                placeholder="Seu nome"
                bind:value={name}
                required={authMode === 'register'}
              />
            </div>
          {/if}

          <!-- E-mail -->
          <div class="relative animate-fade-in">
            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <input
              type="email"
              class="w-full bg-surface/40 border border-white/5 rounded-xl pl-11 pr-4 py-4 text-sm focus:border-primary focus:bg-surface/80 focus:outline-none transition-all placeholder:text-white/30 text-white"
              placeholder="Seu e-mail"
              bind:value={email}
              required
            />
          </div>

          <!-- Senha -->
          <div class="relative animate-fade-in">
            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              class="w-full bg-surface/40 border border-white/5 rounded-xl pl-11 pr-11 py-4 text-sm focus:border-primary focus:bg-surface/80 focus:outline-none transition-all placeholder:text-white/30 text-white"
              placeholder="Sua senha"
              value={password}
              on:input={(e) => password = e.currentTarget.value}
              required
            />
            <button 
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              on:click={() => showPassword = !showPassword}
            >
              {#if showPassword}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {/if}
            </button>
          </div>

          <!-- Lembrar de mim e Esqueci a senha -->
          {#if authMode === 'login'}
            <div class="flex justify-between items-center mt-1 animate-fade-in">
              <label class="flex items-center gap-2.5 cursor-pointer group select-none">
                <div class="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors {rememberMe ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-white/40'}">
                  {#if rememberMe}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {/if}
                </div>
                <input type="checkbox" bind:checked={rememberMe} class="hidden" />
                <span class="text-[14px] text-white/60 group-hover:text-white/90 transition-colors">Lembrar de mim</span>
              </label>

              <button type="button" class="text-[14px] text-primary hover:text-primary/80 transition-colors">
                Esqueci minha senha
              </button>
            </div>
          {/if}

          <!-- Mensagem de Erro -->
          {#if errorMessage}
            <div class="text-red-400 text-xs text-center mt-1 mb-1 animate-fade-in bg-red-500/10 py-2.5 rounded-xl border border-red-500/20">
              {errorMessage}
            </div>
          {/if}

          <!-- Mensagem de Sucesso -->
          {#if successMessage}
            <div class="text-green-400 text-xs text-center mt-1 mb-1 animate-fade-in bg-green-500/10 py-2.5 rounded-xl border border-green-500/20">
              {successMessage}
            </div>
          {/if}

          <!-- Submit Button -->
          <button 
            type="submit" 
            class="w-full bg-primary flex items-center justify-center gap-2 text-white rounded-xl py-4 font-bold shadow-[0_4px_20px_rgba(124,92,255,0.4)] transition-transform active:scale-95 mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={(authMode === 'register' && !name.trim()) || !email.trim() || !password || isLoading}
          >
            <span class="text-base">{isLoading ? 'Aguarde...' : (authMode === 'login' ? 'Entrar' : 'Cadastrar')}</span>
            {#if authMode === 'login' && !isLoading}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            {/if}
          </button>
        </form>

        <!-- Trust Card -->
        <div class="w-full bg-surface/40 border border-white/5 rounded-xl p-4 mt-6 flex items-center gap-4 animate-fade-in">
          <div class="w-[42px] h-[42px] rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><rect x="9" y="10" width="6" height="6" rx="1.5" ry="1.5"/><path d="M12 10v2"/></svg>
          </div>
          <div class="text-left">
            <h4 class="text-[14px] font-semibold text-white mb-0.5">Seus dados estão seguros</h4>
            <p class="text-[13px] text-white/50">Privacidade e segurança são nossa prioridade.</p>
          </div>
        </div>

      </div>
    {:else if step === 2}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🎯</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Qual é o seu objetivo?</h1>
          <p class="text-sm text-white/60">Isso ajuda a personalizar seu resumo de progresso.</p>
        </div>

        <div class="w-full flex flex-col gap-2">
          {#each GOALS as g}
            <button
              class="w-full rounded-xl py-3 text-sm font-medium border {goal === g.value ? 'bg-primary text-white border-primary' : 'bg-surface border-white/10 text-white/80'}"
              on:click={() => (goal = g.value)}
            >
              {g.label}
            </button>
          {/each}
        </div>

        <div class="w-full flex gap-2">
          <button class="flex-1 bg-white/10 rounded-xl py-3 text-sm" on:click={back}>Voltar</button>
          <button class="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40" disabled={!goal} on:click={next}>
            Continuar
          </button>
        </div>
      </div>
    {:else}
      <div class="w-full text-center flex flex-col items-center gap-5">
        <!-- Logo Icon -->
        <div class="w-16 h-16 rounded-full border border-primary/30 flex items-center justify-center text-3xl mb-1 shadow-[0_0_30px_rgba(124,92,255,0.2)] bg-gradient-to-br from-surface to-bg relative overflow-hidden">
          <div class="absolute inset-0 bg-primary/10"></div>
          <span class="relative z-10">📏</span>
        </div>
        
        <div>
          <h1 class="text-2xl font-bold mb-1 tracking-tight">Só mais um <span class="text-primary">pouco</span>!</h1>
          <p class="text-xs text-white/50 text-center max-w-[280px]">
            Idade, peso e altura de hoje — pra você acompanhar sua evolução depois. Pode pular se preferir.
          </p>
        </div>

        <div class="w-full flex gap-3">
          <!-- Card Idade -->
          <div class="flex-1 bg-surface/80 rounded-2xl border border-white/5 p-3 flex flex-col relative overflow-hidden shadow-sm">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[9px] font-bold text-primary tracking-wider uppercase">Idade</span>
              <span class="text-primary/70 text-xs">📅</span>
            </div>
            <div class="flex justify-between items-end mt-1">
              <div class="flex flex-col w-full text-left">
                <input type="number" class="bg-transparent text-2xl font-bold text-white w-full outline-none p-0" bind:value={age} placeholder="--" />
                <span class="text-[10px] text-white/40">anos</span>
              </div>
            </div>
          </div>
          
          <!-- Card Peso -->
          <div class="flex-1 bg-surface/80 rounded-2xl border border-white/5 p-3 flex flex-col relative overflow-hidden shadow-sm">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[9px] font-bold text-primary tracking-wider uppercase">Peso</span>
              <span class="text-primary/70 text-xs">⚖️</span>
            </div>
            <div class="flex justify-between items-end mt-1">
              <div class="flex flex-col w-full text-left">
                <input type="number" class="bg-transparent text-2xl font-bold text-white w-full outline-none p-0" bind:value={weight} placeholder="--" />
                <span class="text-[10px] text-white/40">kg</span>
              </div>
            </div>
          </div>
          
          <!-- Card Altura -->
          <div class="flex-1 bg-surface/80 rounded-2xl border border-white/5 p-3 flex flex-col relative overflow-hidden shadow-sm">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[9px] font-bold text-primary tracking-wider uppercase">Altura</span>
              <span class="text-primary/70 text-xs">📏</span>
            </div>
            <div class="flex justify-between items-end mt-1">
              <div class="flex flex-col w-full text-left">
                <input type="number" class="bg-transparent text-2xl font-bold text-white w-full outline-none p-0" bind:value={height} placeholder="--" />
                <span class="text-[10px] text-white/40">cm</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Banner de Privacidade/Confiança -->
        <div class="w-full bg-surface/80 rounded-2xl border border-white/5 p-4 shadow-md mt-1 relative overflow-hidden">
          <div class="flex gap-4 items-center mb-4 text-left">
            <div class="text-3xl text-primary">🛡️</div>
            <div>
              <h3 class="font-bold text-white text-sm">Dados para o seu progresso</h3>
              <p class="text-[10px] text-white/50 leading-tight mt-1 pr-2">Essas informações nos ajudam a personalizar sua jornada e gerar análises ainda mais precisas.</p>
            </div>
          </div>
          
          <div class="flex justify-between border-t border-white/5 pt-3">
            <div class="flex flex-col gap-1.5 items-start w-1/3 border-r border-white/5 pr-2">
              <span class="text-primary/80 text-sm">📊</span>
              <span class="text-[9px] text-white/50 text-left leading-tight">Acompanhe sua<br>evolução</span>
            </div>
            <div class="flex flex-col gap-1.5 items-start w-1/3 border-r border-white/5 px-2">
              <span class="text-primary/80 text-sm">🎯</span>
              <span class="text-[9px] text-white/50 text-left leading-tight">Metas mais<br>precisas</span>
            </div>
            <div class="flex flex-col gap-1.5 items-start w-1/3 pl-2">
              <span class="text-primary/80 text-sm">📈</span>
              <span class="text-[9px] text-white/50 text-left leading-tight">Resultados com<br>significado</span>
            </div>
          </div>
        </div>

        <div class="w-full flex flex-col gap-3 mt-2">
          <!-- Botão Primário -->
          <button 
            class="w-full bg-primary flex items-center justify-between text-white rounded-xl py-4 px-6 font-bold shadow-[0_4px_20px_rgba(124,92,255,0.4)] transition-transform active:scale-95" 
            on:click={finish}
            disabled={saving}
          >
            <span class="flex-1 text-center">{saving ? 'Preparando...' : 'Começar jornada'}</span>
            <div class="w-6 h-6 bg-bg/40 rounded-full flex items-center justify-center text-xs opacity-80">›</div>
          </button>
          
          <!-- Botão Secundário -->
          <button 
            class="w-full bg-surface border border-white/5 text-white/90 rounded-xl py-4 font-semibold hover:bg-white/5 transition-colors" 
            on:click={back}
            disabled={saving}
          >
            Voltar
          </button>
        </div>

        <button class="text-[11px] text-white/30 hover:text-white/50 transition-colors mt-2" on:click={finish} disabled={saving}>
          Pular por agora →
        </button>
      </div>
    {/if}
  </div>
</main>
