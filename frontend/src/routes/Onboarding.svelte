<script>
  import { db } from '../db/db.js';
  import { GOALS } from '../lib/constants.js';

  // Onboarding em 3 passos curtos: nome, objetivo, métricas básicas.
  // Nada de quiz nem chamada de IA — o app funciona 100% offline desde o
  // primeiro segundo. Perimetria detalhada (circunferências etc.) fica
  // pra tela de Métricas, quando o usuário quiser se aprofundar depois.
  let step = 0;
  const totalSteps = 3;

  let name = '';
  let email = '';
  let password = '';
  let saveToCloud = true;
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

  function next() {
    if (step === 1 && !name.trim()) return;
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
      <div class="w-full text-center flex flex-col items-center gap-5">
        <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">☁️</div>
        <div>
          <h1 class="text-xl font-semibold mb-1">Proteja seu progresso</h1>
          <p class="text-sm text-white/60 px-2">Crie sua conta. Seus dados serão salvos na nuvem para você nunca perder seu progresso.</p>
        </div>

        <form on:submit|preventDefault={next} class="w-full flex flex-col gap-3 text-left">
          <input
            class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-primary focus:outline-none transition-colors"
            placeholder="Seu Nome"
            bind:value={name}
            required
            autofocus
          />

          <label class="flex items-center gap-2 px-1 mt-1 cursor-pointer select-none">
            <input type="checkbox" bind:checked={saveToCloud} class="accent-primary w-4 h-4 rounded" />
            <span class="text-xs text-white/80">Salvar meu progresso na nuvem</span>
          </label>

          {#if saveToCloud}
            <div class="flex flex-col gap-3 mt-1 animate-fade-in">
              <input
                type="email"
                class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm"
                placeholder="Seu E-mail"
                bind:value={email}
                required
              />
              <input
                type="password"
                class="bg-surface border border-white/10 rounded-xl px-4 py-3.5 text-sm"
                placeholder="Crie uma Senha"
                bind:value={password}
                required
              />
            </div>
          {/if}

          <button 
            type="submit" 
            class="bg-primary text-white rounded-xl py-3.5 font-medium disabled:opacity-40 mt-2 transition-all" 
            disabled={!name.trim() || (saveToCloud && (!email.trim() || !password))}
          >
            Continuar
          </button>
        </form>
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
