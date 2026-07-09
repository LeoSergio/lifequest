<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import StatsBar from '../components/StatsBar.svelte';
  import MissionCard from '../components/MissionCard.svelte';

  // liveQuery = a "mágica" do local-first: essa query roda de novo
  // AUTOMATICAMENTE toda vez que a tabela player ou missions muda no
  // IndexedDB. Não precisamos de fetch, refresh manual, nem estado global.
  const player = liveQuery(() => db.player.toCollection().first());
  const missions = liveQuery(() => db.missions.where('status').equals('pending').toArray());

  async function completeMission(event) {
    const mission = event.detail;
    const current = await db.player.toCollection().first();

    const { level, xp, leveledUp } = applyXp(current.level, current.xp, mission.xpReward);

    await db.player.update(current.id, { level, xp });
    await db.missions.update(mission.id, { status: 'done' });

    if (leveledUp) {
      // Placeholder simples por enquanto — na Etapa 8 (motor de gamificação)
      // isso pode virar uma animação/modal de "level up!".
      alert(`Level up! Agora você é nível ${level} 🎉`);
    }
  }
</script>

<main class="min-h-screen p-6 flex flex-col gap-6 max-w-md mx-auto">
  {#await $player then p}
    {#if p}
      <div>
        <h1 class="text-2xl font-bold text-primary">{p.archetype}</h1>
        <p class="text-sm text-white/60">{p.archetypeDescription}</p>
      </div>

      <StatsBar level={p.level} xp={p.xp} streak={p.streak} />
    {/if}
  {/await}

  <div>
    <h2 class="text-sm uppercase text-white/40 mb-3">Missões de hoje</h2>
    <div class="flex flex-col gap-3">
      {#await $missions then list}
        {#if list.length === 0}
          <p class="text-sm text-white/40">Nenhuma missão pendente. 🎉</p>
        {:else}
          {#each list as mission (mission.id)}
            <MissionCard {mission} on:complete={completeMission} />
          {/each}
        {/if}
      {/await}
    </div>
  </div>
</main>
