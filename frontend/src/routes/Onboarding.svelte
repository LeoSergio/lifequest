<script>
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { GOALS } from '../lib/constants.js';
  import { api } from '../lib/api.js';
  import { onMount, tick } from 'svelte';

  // Onboarding em 3 passos curtos: nome, objetivo, métricas básicas.
  // Nada de quiz nem chamada de IA — o app funciona 100% offline desde o
  // primeiro segundo. Perimetria detalhada (circunferências etc.) fica
  // pra tela de Métricas, quando o usuário quiser se aprofundar depois.
  let step = 0;
  const totalSteps = 3;

  let name = '';
  let errorMessage = '';
  let successMessage = '';
  let isLoading = false;
  let goal = null;
  let pendingToken = null;

  let age = '';
  let weight = '';
  let height = '';

  let saving = false;

  const starterHabits = [
    { title: 'Beber 2L de água', icon: '💧', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Dormir 7-8h', icon: '😴', cadence: 'daily', weeklyTarget: null, xpReward: 10 },
    { title: 'Treinar', icon: '💪', cadence: 'weekly', weeklyTarget: 4, xpReward: 20 }
  ];

  const GOOGLE_CLIENT_ID = "228718930815-9b532nkd4ikhdtl3v72mtgch9ujabltm.apps.googleusercontent.com";

  async function handleGoogleCredentialResponse(response) {
    if (!response.credential) return;
    isLoading = true;
    errorMessage = '';
    try {
      const data = await api.loginGoogle(response.credential);
      
      const { pullSync } = await import('../services/syncService.js');
      // Set token temporarily for pullSync to work
      localStorage.setItem('access_token', data.access_token);
      await pullSync();

      const existingPlayer = await db.player.toCollection().first();
      
      if (!existingPlayer) {
        // Novo usuário pelo Google, avança pro onboarding
        name = data.name || 'Herói';
        pendingToken = data.access_token;
        // Limpa o token pra não dar conflito no meio do onboarding
        localStorage.removeItem('access_token'); 
        step = 2;
      } else {
        // Usuário antigo, já tem dados, o app vai carregar sozinho
      }
    } catch (err) {
      errorMessage = err?.data?.detail || 'Erro ao entrar com Google.';
      localStorage.removeItem('access_token');
    } finally {
      isLoading = false;
    }
  }

  function googleLoginAction(node) {
    function init() {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          context: "signin",
          ux_mode: "popup"
        });
        window.google.accounts.id.renderButton(node, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: node.offsetWidth ? Math.min(node.offsetWidth, 300) : 300
        });
      } else {
        setTimeout(init, 500);
      }
    }
    init();
  }

  async function next() {
    errorMessage = '';
    successMessage = '';

    if (step === 1) {
      // Step 1 is now exclusively handled by handleGoogleCredentialResponse (or Apple)
      // They won't click "next" manually for step 1 anymore.
      return;
    }

    if (step === 2 && !goal) return;
    step += 1;
  }

  function back() {
    step -= 1;
  }

  import { enqueue, pushSync } from '../services/syncService.js';

  async function finish() {
    if (!name.trim() || !goal || saving) return;
    saving = true;

    try {
      const playerId = generateId();
      const playerData = {
        id: playerId,
        name: name.trim(),
        goal,
        level: 1,
        xp: 0,
        coins: 0,
        streak: 0,
        createdAt: new Date().toISOString()
      };
      await db.player.add(playerData);
      await enqueue('upsert', 'player', playerId, playerData);

      // Métricas básicas são opcionais — só grava se pelo menos uma foi
      // preenchida, pra não criar uma medição vazia sem sentido.
      if (age || weight || height) {
        const mId = generateId();
        const mData = {
          id: mId,
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
        };
        await db.bodyMeasurements.add(mData);
        await enqueue('upsert', 'bodyMeasurements', mId, mData);
      }

      const habitItems = starterHabits.map((h) => ({
        ...h,
        id: generateId(),
        archivedAt: null,
        createdAt: new Date().toISOString()
      }));

      await db.habits.bulkAdd(habitItems);
      for (const h of habitItems) {
        await enqueue('upsert', 'habits', h.id, h);
      }

      // Salva o token no localStorage apenas no final do fluxo, para que o
      // worker de sincronização não puxe o perfil antes da hora e pule a tela.
      if (pendingToken) {
        localStorage.setItem('access_token', pendingToken);
        pushSync().catch(() => {});
      }
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
          <h1 class="text-[28px] font-bold mb-2">Seu <span class="text-primary">progresso</span></h1>
          <p class="text-[14px] text-white/60 leading-relaxed px-4">Faça login com sua conta preferida para sincronizar seus treinos e conquistas.</p>
        </div>

        <div class="w-full flex flex-col items-center gap-3.5 mb-6 max-w-[300px] mx-auto">
          <div class="w-full flex justify-center" use:googleLoginAction></div>
          
          <button 
            type="button" 
            class="w-full h-[40px] bg-white text-black flex items-center justify-center gap-2 rounded-[4px] font-medium text-[14px] border border-[#dadce0] hover:bg-gray-50 transition-colors shadow-sm relative"
          >
            <svg class="w-5 h-5 absolute left-3" viewBox="0 0 384 512" fill="currentColor">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
            </svg>
            <span class="font-roboto flex-1 text-center font-medium text-[#3c4043] tracking-[0.25px]">Continuar com Apple</span>
          </button>
        </div>

        <!-- Mensagem de Erro/Loading -->
        {#if isLoading}
          <div class="text-white/60 text-xs text-center mt-1 mb-1 animate-fade-in flex items-center gap-2 justify-center">
            <svg class="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Conectando...
          </div>
        {/if}

        {#if errorMessage}
          <div class="text-red-400 text-xs text-center mt-1 mb-1 animate-fade-in bg-red-500/10 py-2.5 rounded-xl border border-red-500/20 px-4 w-[280px]">
            {errorMessage}
          </div>
        {/if}

        <!-- Trust Card -->
        <div class="w-full bg-surface/40 border border-white/5 rounded-xl p-4 mt-6 flex items-center gap-4 animate-fade-in max-w-[280px]">
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
