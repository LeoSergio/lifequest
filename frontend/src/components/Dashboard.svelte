<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import StatsBar from '../components/StatsBar.svelte';
  import MissionCard from '../components/MissionCard.svelte';
  import StreakCalendar from '../components/StreakCalendar.svelte';

  const player = liveQuery(() => db.player.toCollection().first());
  const missions = liveQuery(() => db.missions.where('status').equals('pending').toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());

  // Streak sempre derivado do histórico de sessões — nunca lido de um
  // campo "streak" guardado solto (ver comentário em lib/metrics.js).
  $: streak = $sessions ? currentStreak($sessions) : 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];

  async function completeMission(event) {
    const mission = event.detail;
    const current = await db.player.toCollection().first();

    const { level, xp, leveledUp } = applyXp(current.level, current.xp, mission.xpReward);

    await db.player.update(current.id, { level, xp });
    await db.missions.update(mission.id, { status: 'done' });

    if (leveledUp) {
      alert(`Level up! Agora você é nível ${level} 🎉`);
    }
  }
</script>

<main class="min-h-screen p-6 pb-24 flex flex-col gap-6 max-w-md mx-auto">
  {#if $player}
    <div>
      <h1 class="text-2xl font-bold text-primary">{$player.archetype}</h1>
      <p class="text-sm text-white/60">{$player.archetypeDescription}</p>
    </div>

    <StatsBar level={$player.level} xp={$player.xp} {streak} />
  {/if}

  <StreakCalendar days={weekActivity} {streak} />

  <div>
    <h2 class="text-sm uppercase text-white/40 mb-3">Missões de hoje</h2>
    <div class="flex flex-col gap-3">
      {#if $missions === undefined}
        <p class="text-sm text-white/40">Carregando missões...</p>
      {:else if $missions.length === 0}
        <p class="text-sm text-white/40">Nenhuma missão pendente. 🎉</p>
      {:else}
        {#each $missions as mission (mission.id)}
          <MissionCard {mission} on:complete={completeMission} />
        {/each}
      {/if}
    </div>
  </div>
</main>
