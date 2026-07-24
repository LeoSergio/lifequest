<script>
  import { isGoalAchieved } from '../lib/goals.js';
  import { allGoalsQuery } from '../repositories/goalRepository.js';
  import { addGoal, addProgress } from '../services/goalService.js';
  import GoalCard from '../components/GoalCard.svelte';

  const allGoals = allGoalsQuery();

  let tab = 'ativas'; // ativas | alcancadas
  let showForm = false;

  let title = '';
  let targetValue = 5;
  let unit = '';
  let reward = '';
  let difficulty = 'medium';
  let deadline = '';

  const TEMPLATES = [
    { title: 'Treinar 4x/semana', targetValue: 16, unit: 'treinos', difficulty: 'medium', deadlineOffsetDays: 30, emoji: '💪' },
    { title: 'Secando (Reduzir)', targetValue: 2, unit: 'kg', difficulty: 'medium', deadlineOffsetDays: 30, emoji: '⚖️' },
    { title: 'Foco Hidratação', targetValue: 7, unit: 'dias', difficulty: 'easy', deadlineOffsetDays: 7, emoji: '💧' },
    { title: 'Aumentar Supino', targetValue: 10, unit: 'kg', difficulty: 'hard', deadlineOffsetDays: 60, emoji: '🏋️' }
  ];

  function applyTemplate(t) {
    title = t.title;
    targetValue = t.targetValue;
    unit = t.unit;
    difficulty = t.difficulty;
    const d = new Date();
    d.setDate(d.getDate() + t.deadlineOffsetDays);
    deadline = d.toISOString().slice(0, 10);
    showForm = true;
  }

  // Estado da tela de celebração — não é uma rota própria, é só um
  // overlay que aparece por cima da lista quando uma meta é batida.
  let celebrating = null; // goal | null

  $: filtered = ($allGoals ?? []).filter((g) => (tab === 'ativas' ? !g.achievedAt : !!g.achievedAt));

  async function createGoal() {
    if (!title.trim() || !targetValue) return;
    await addGoal({ title, targetValue, unit, reward, deadline });
    title = '';
    targetValue = 5;
    unit = '';
    reward = '';
    difficulty = 'medium';
    deadline = '';
    showForm = false;
  }

  async function handleProgress(event) {
    const { goal, amount } = event.detail;
    const result = await addProgress(goal, amount);
    if (!result) return;

    if (result.leveledUp) alert(`Level up! Agora você é nível ${result.level} 🎉`);
    if (result.achieved) celebrating = result.updatedGoal;
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
      class="shrink-0 bg-primary text-white rounded-full px-3 py-2 text-xs font-medium"
      on:click={() => (showForm = !showForm)}
    >
      + Nova
    </button>
  </div>

  <!-- Metas Sugeridas (Templates) -->
  {#if !showForm}
    <div class="mt-6 mb-8">
      <h2 class="text-xs uppercase font-bold text-white/40 mb-3 tracking-wider">Inspirações</h2>
      <div class="flex overflow-x-auto gap-3 pb-2 -mx-6 px-6 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {#each TEMPLATES as t}
          <button class="shrink-0 w-36 bg-surface border border-white/5 rounded-2xl p-4 text-left snap-center hover:bg-white/5 transition-colors shadow-sm" on:click={() => applyTemplate(t)}>
            <div class="text-3xl mb-3 filter drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{t.emoji}</div>
            <h3 class="font-bold text-sm text-white mb-1 leading-tight">{t.title}</h3>
            <p class="text-[10px] text-white/40">Foco em Conquistas</p>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if showForm}
    <div class="fixed inset-0 bg-bg/95 z-20 flex flex-col p-6 overflow-y-auto">
      <div class="flex justify-between items-center mb-6 mt-4">
        <h2 class="text-xl font-bold text-white">Nova Meta</h2>
        <button class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-white/50" on:click={() => showForm = false}>✕</button>
      </div>

      <form on:submit|preventDefault={createGoal} class="flex flex-col gap-4">
        <div>
          <label class="text-xs text-white/40 mb-1 block">Título da meta</label>
          <input
            class="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-colors"
            placeholder="ex: Correr 5km sem parar"
            bind:value={title}
          />
        </div>

        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-xs text-white/40 mb-1 block">Alvo Numérico</label>
            <input
              type="number"
              min="1"
              class="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-colors"
              placeholder="Ex: 5"
              bind:value={targetValue}
            />
          </div>
          <div class="w-24">
            <label class="text-xs text-white/40 mb-1 block">Unidade</label>
            <input
              class="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-colors"
              placeholder="kg, km..."
              bind:value={unit}
            />
          </div>
        </div>

        <div>
          <label class="text-xs text-white/40 mb-1 block">Recompensa pessoal (Opcional)</label>
          <input
            class="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-colors"
            placeholder="O que você vai se dar de presente?"
            bind:value={reward}
          />
        </div>

        <!-- Removido: seleção de dificuldade e XP -->

        <div>
          <label class="text-xs text-white/40 mb-1 block">Data Limite (Opcional)</label>
          <input type="date" class="w-full bg-surface border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-colors text-white" bind:value={deadline} />
        </div>

        <button type="submit" class="w-full bg-primary text-white rounded-xl py-4 font-bold mt-2 hover:bg-primary/90 transition-colors">
          Criar meta
        </button>
      </form>
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
        <GoalCard {goal} on:progress={handleProgress} />
      {/each}
    </div>
  {/if}

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
</div>
