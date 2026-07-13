<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { isGoalAchieved } from '../lib/goals.js';
  import GoalCard from '../components/GoalCard.svelte';

  const allGoals = liveQuery(() => db.goals.orderBy('createdAt').reverse().toArray());

  let tab = 'ativas'; // ativas | alcancadas
  let showForm = false;

  let title = '';
  let targetValue = 5;
  let unit = '';
  let reward = '';
  let xpReward = 50;
  let deadline = '';

  // Estado da tela de celebração — não é uma rota própria, é só um
  // overlay que aparece por cima da lista quando uma meta é batida.
  let celebrating = null; // goal | null

  $: filtered = ($allGoals ?? []).filter((g) => (tab === 'ativas' ? !g.achievedAt : !!g.achievedAt));

  async function createGoal() {
    if (!title.trim() || !targetValue) return;

    await db.goals.add({
      title: title.trim(),
      targetValue: Number(targetValue),
      currentValue: 0,
      unit: unit.trim() || null,
      reward: reward.trim() || null,
      xpReward: Number(xpReward) || 0,
      deadline: deadline || null,
      achievedAt: null,
      createdAt: new Date().toISOString()
    });

    title = '';
    targetValue = 5;
    unit = '';
    reward = '';
    xpReward = 50;
    deadline = '';
    showForm = false;
  }

  async function addProgress(event) {
    const { goal, amount } = event.detail;
    if (!amount) return;

    const newValue = Math.min(goal.targetValue, goal.currentValue + amount);
    const wasAchieved = isGoalAchieved(goal);
    const nowAchieved = newValue >= goal.targetValue;

    const updates = { currentValue: newValue };
    if (!wasAchieved && nowAchieved) updates.achievedAt = new Date().toISOString();

    await db.goals.update(goal.id, updates);

    // XP extra da meta só é concedido uma vez, no momento exato em que
    // ela vira "alcançada" — nunca de novo, mesmo que o registro seja
    // reaberto/editado depois.
    if (!wasAchieved && nowAchieved) {
      const player = await db.player.toCollection().first();
      if (player) {
        const { level, xp, leveledUp } = applyXp(player.level, player.xp, goal.xpReward);
        await db.player.update(player.id, { level, xp });
        if (leveledUp) alert(`Level up! Agora você é nível ${level} 🎉`);
      }
      celebrating = { ...goal, ...updates };
    }
  }

  function newSimilarGoal() {
    title = `${celebrating.title} (nova rodada)`;
    targetValue = celebrating.targetValue;
    unit = celebrating.unit ?? '';
    reward = celebrating.reward ?? '';
    xpReward = celebrating.xpReward;
    deadline = '';
    celebrating = null;
    showForm = true;
  }
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto relative">
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

  {#if showForm}
    <form on:submit|preventDefault={createGoal} class="bg-surface rounded-xl p-4 my-4 flex flex-col gap-3">
      <input
        class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Título da meta (ex: correr 5km sem parar)"
        bind:value={title}
      />

      <div class="flex gap-2">
        <input
          type="number"
          min="1"
          class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="Valor alvo"
          bind:value={targetValue}
        />
        <input
          class="w-20 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="Unid."
          bind:value={unit}
        />
      </div>

      <input
        class="bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
        placeholder="Recompensa ao concluir (opcional)"
        bind:value={reward}
      />

      <div class="flex gap-2">
        <input
          type="number"
          min="0"
          class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm"
          placeholder="XP extra"
          bind:value={xpReward}
        />
        <input type="date" class="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-3 text-sm" bind:value={deadline} />
      </div>

      <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium">Criar meta</button>
    </form>
  {/if}

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
        <GoalCard {goal} on:progress={addProgress} />
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
            <p class="text-lg font-bold text-xp">+{celebrating.xpReward}</p>
            <p class="text-[10px] text-white/40">XP extra</p>
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
</main>
