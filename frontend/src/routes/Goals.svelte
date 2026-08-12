<script>
  import { isGoalAchieved } from '../lib/goals.js';
  import { allGoalsQuery } from '../repositories/goalRepository.js';
  import { addGoal, addProgress } from '../services/goalService.js';
  import GoalCard from '../components/GoalCard.svelte';
  import { pushSync } from '../services/syncService.js';
  import { showAlert, showConfirm } from '../lib/modal.js';

  const allGoals = allGoalsQuery();

  let tab = 'ativas'; // ativas | alcancadas
  let showForm = false;
  let step = 1;
  let selectedCat = null;

  let title = '';
  let targetValue = 5;
  let unit = '';
  let reward = '';
  let deadline = '';

  const CATEGORIES = [
    { id: 'health', title: 'Saúde', desc: 'Corpo & Físico', icon: '💪', color: 'text-emerald-400', bg: 'bg-emerald-400/10 hover:bg-emerald-400/20', border: 'border-emerald-400/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(52,211,153,0.1)]' },
    { id: 'finance', title: 'Finanças', desc: 'Dinheiro', icon: '💰', color: 'text-yellow-400', bg: 'bg-yellow-400/10 hover:bg-yellow-400/20', border: 'border-yellow-400/30 hover:border-yellow-400/60 shadow-[0_0_15px_rgba(250,204,21,0.1)]' },
    { id: 'learning', title: 'Aprender', desc: 'Habilidades', icon: '📚', color: 'text-blue-400', bg: 'bg-blue-400/10 hover:bg-blue-400/20', border: 'border-blue-400/30 hover:border-blue-400/60 shadow-[0_0_15px_rgba(96,165,250,0.1)]' },
    { id: 'productivity', title: 'Foco', desc: 'Eficiência', icon: '🚀', color: 'text-purple-400', bg: 'bg-purple-400/10 hover:bg-purple-400/20', border: 'border-purple-400/30 hover:border-purple-400/60 shadow-[0_0_15px_rgba(192,132,252,0.1)]' },
    { id: 'mind', title: 'Mente', desc: 'Paz & Stress', icon: '🧘', color: 'text-pink-400', bg: 'bg-pink-400/10 hover:bg-pink-400/20', border: 'border-pink-400/30 hover:border-pink-400/60 shadow-[0_0_15px_rgba(244,114,182,0.1)]' },
    { id: 'other', title: 'Outros', desc: 'Meta livre', icon: '✨', color: 'text-white', bg: 'bg-white/5 hover:bg-white/10', border: 'border-white/20 hover:border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.05)]' },
  ];

  function openNewGoal() {
    title = ''; targetValue = 1; unit = ''; reward = ''; deadline = '';
    selectedCat = null; step = 1; showForm = true;
  }

  function selectCategory(cat) {
    selectedCat = cat;
    unit = '';
    title = `${cat.icon} `; // Pre-fixa o título com o ícone
    step = 2;
  }

  // Estado da tela de celebração
  let celebrating = null; // goal | null

  $: filtered = ($allGoals ?? []).filter((g) => (tab === 'ativas' ? !g.achievedAt : !!g.achievedAt));

  async function createGoal() {
    if (!title.trim()) return;
    await addGoal({ title, targetValue: 1, unit: '', reward, deadline });
    showForm = false;
    pushSync().catch(() => {});
  }

  async function handleDelete(event) {
    const goalId = event.detail;
    const confirmDelete = await showConfirm({
      title: 'Excluir Meta',
      message: 'Tem certeza que deseja excluir esta meta? Essa ação não pode ser desfeita.',
      icon: '🗑️',
      type: 'danger',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });

    if (confirmDelete) {
      await deleteGoal(goalId);
      pushSync().catch(() => {});
    }
  }

  async function handleProgress(event) {
    const { goal, amount } = event.detail;
    const result = await addProgress(goal, amount);
    if (!result) return;

    pushSync().catch(() => {});

    if (result.leveledUp) showAlert({
      title: `Level Up! 🎉`,
      message: `+${result.xpGained} XP — Agora você é nível ${result.level}!`,
      icon: '⭐',
      type: 'success',
      confirmText: 'Boa!',
    });
    if (result.achieved) celebrating = { ...result.updatedGoal, xpGained: result.xpGained };
  }

  function newSimilarGoal() {
    title = `${celebrating.title} (nova rodada)`;
    targetValue = celebrating.targetValue;
    unit = celebrating.unit ?? '';
    reward = celebrating.reward ?? '';
    deadline = '';
    celebrating = null;
    showForm = true;
  }
</script>

<div class="relative">
  <div class="flex justify-between items-start mb-1">
    <div>
      <h1 class="text-2xl font-bold text-primary">Metas</h1>
      <p class="text-sm text-white/60">Objetivos com recompensa quando você chega lá.</p>
    </div>
    <button
      class="shrink-0 bg-[#9333EA] text-white rounded-full px-3 py-2 text-xs font-bold hover:bg-[#a855f7] transition-colors shadow-[0_0_12px_rgba(147,51,234,0.4)]"
      on:click={openNewGoal}
    >
      + Nova Meta
    </button>
  </div>

  <!-- Cabeçalho removido os templates para deixar mais limpo -->

  {#if showForm}
    <div class="fixed inset-0 bg-[#0f0f14]/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div class="bg-[#1C1C22]/95 border border-white/10 rounded-[28px] w-full max-w-sm flex flex-col shadow-[0_0_40px_rgba(147,51,234,0.15)] overflow-hidden">
        
        <!-- Header -->
        <div class="p-5 pb-4 border-b border-white/5 relative">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-black text-white">Criar Nova Meta</h2>
            <button class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors" on:click={() => showForm = false}>✕</button>
          </div>
          
          <!-- Progress Bar -->
          <div class="w-full bg-white/5 rounded-full h-1.5 flex gap-1">
            <div class="flex-1 rounded-full {step >= 1 ? 'bg-[#9333EA] shadow-[0_0_8px_rgba(147,51,234,0.6)]' : 'bg-transparent'} transition-all"></div>
            <div class="flex-1 rounded-full {step >= 2 ? 'bg-[#9333EA] shadow-[0_0_8px_rgba(147,51,234,0.6)]' : 'bg-white/10'} transition-all"></div>
          </div>
          <p class="text-[10px] text-white/40 mt-2 font-bold uppercase tracking-wider">Passo {step} de 2</p>
        </div>

        <!-- Body -->
        <div class="p-5 max-h-[70vh] overflow-y-auto">
          {#if step === 1}
            <p class="text-sm text-white/70 mb-4">Em qual área da sua vida você quer focar?</p>
            <div class="grid grid-cols-2 gap-3">
              {#each CATEGORIES as cat}
                <button class="flex flex-col items-center justify-center p-4 rounded-2xl border transition-all {cat.bg} {cat.border}" on:click={() => selectCategory(cat)}>
                  <span class="text-3xl mb-2 drop-shadow-md">{cat.icon}</span>
                  <span class="font-bold text-sm text-white mb-0.5">{cat.title}</span>
                  <span class="text-[10px] {cat.color} opacity-80">{cat.desc}</span>
                </button>
              {/each}
            </div>
          {:else}
            <form on:submit|preventDefault={createGoal} class="flex flex-col gap-5">
              
              <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                <span class="text-3xl">{selectedCat.icon}</span>
                <div>
                  <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold">{selectedCat.title}</p>
                  <p class="text-xs text-white/70">Configure os detalhes da sua meta.</p>
                </div>
              </div>

              <div>
                <label for="goal-title" class="text-[11px] font-bold text-white/50 mb-1.5 block uppercase tracking-wider">Título da meta</label>
                <input
                  id="goal-title"
                  class="w-full bg-[#0f0f14]/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-[#a855f7] outline-none transition-colors text-white"
                  placeholder="ex: Ler 10 páginas por dia"
                  bind:value={title}
                  autofocus
                />
              </div>

              <!-- Alvo numérico removido por ser complexo demais. A meta agora é do tipo "concluir ou não concluir" por padrão -->

              <div>
                <label for="goal-reward" class="text-[11px] font-bold text-white/50 mb-1.5 block uppercase tracking-wider">Recompensa Pessoal</label>
                <input
                  id="goal-reward"
                  class="w-full bg-[#0f0f14]/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-[#a855f7] outline-none transition-colors text-white placeholder:text-white/20"
                  placeholder="Ex: Comprar um tênis novo"
                  bind:value={reward}
                />
              </div>

              <div>
                <label for="goal-deadline" class="text-[11px] font-bold text-white/50 mb-1.5 block uppercase tracking-wider">Data Limite</label>
                <input 
                  id="goal-deadline" 
                  type="date" 
                  class="w-full bg-[#0f0f14]/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-[#a855f7] outline-none transition-colors text-white/80" 
                  bind:value={deadline} 
                />
              </div>

              <div class="flex gap-2 mt-2">
                <button type="button" class="flex-1 bg-white/5 text-white/70 rounded-xl py-3.5 font-bold hover:bg-white/10 transition-colors" on:click={() => step = 1}>
                  Voltar
                </button>
                <button type="submit" class="flex-[2] bg-[#9333EA] text-white rounded-xl py-3.5 font-bold hover:bg-[#a855f7] transition-colors shadow-[0_0_20px_rgba(147,51,234,0.4)] disabled:opacity-50" disabled={!title.trim()}>
                  Confirmar Meta
                </button>
              </div>
            </form>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <h2 class="text-xs uppercase font-bold text-white/40 mb-3 tracking-wider mt-2">Suas Metas</h2>

  <div class="flex bg-surface rounded-xl p-1 my-4 text-sm">
    {#each [['ativas', 'Ativas'], ['alcancadas', 'Alcançadas']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if $allGoals === undefined}
    <p class="text-sm text-white/40">Carregando metas...</p>
  {:else if filtered.length === 0}
    <p class="text-sm text-white/40">
      {tab === 'alcancadas' ? 'Nenhuma meta alcançada ainda.' : 'Nenhuma meta ativa. Crie a primeira acima.'}
    </p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each filtered as goal (goal.id)}
        <GoalCard {goal} on:progress={handleProgress} on:delete={handleDelete} />
      {/each}
    </div>
  {/if}
</div>

  {#if celebrating}
    <div class="fixed inset-0 bg-bg/90 flex items-center justify-center p-6 z-10">
      <div class="bg-surface rounded-xl p-6 max-w-xs w-full text-center flex flex-col items-center gap-3">
        <span class="text-4xl">🏆</span>
        <div>
          <p class="font-semibold">Meta alcançada!</p>
          <p class="text-sm text-white/60">{celebrating.title}</p>
        </div>
        <div class="bg-bg rounded-lg p-3 w-full flex justify-around">
          <div>
            <p class="text-lg font-bold text-xp">+{celebrating.xpGained ?? 50} XP</p>
            <p class="text-[10px] text-white/40">Experiência ganha</p>
          </div>
          <div>
            <p class="text-lg font-bold text-xp">🏅</p>
            <p class="text-[10px] text-white/40">Conquista Avaliada</p>
          </div>
          {#if celebrating.reward}
            <div>
              <p class="text-sm font-semibold">🎁</p>
              <p class="text-[10px] text-white/40">{celebrating.reward}</p>
            </div>
          {/if}
        </div>
        <div class="flex gap-2 w-full">
          <button class="flex-1 bg-white/10 rounded-lg py-2 text-sm" on:click={() => (celebrating = null)}>
            Fechar
          </button>
          <button class="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium" on:click={newSimilarGoal}>
            Definir próxima
          </button>
        </div>
      </div>
    </div>
  {/if}
