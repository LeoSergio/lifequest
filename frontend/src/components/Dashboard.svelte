<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { applyXp } from '../lib/gamification.js';
  import { currentStreak, last7DaysActivity } from '../lib/metrics.js';
  import { completedToday, todayIso } from '../lib/habits.js';
  import { WEEKDAYS } from '../lib/constants.js';
  import { navigate } from '../lib/nav.js';
  import StatsBar from '../components/StatsBar.svelte';
  import StreakCalendar from '../components/StreakCalendar.svelte';

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  const plans = liveQuery(() => db.workoutPlans.toArray());

  // Streak sempre derivado do histórico de sessões — nunca lido de um
  // campo "streak" guardado solto (ver comentário em lib/metrics.js).
  $: streak = $sessions ? currentStreak($sessions) : 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];

  // Hábitos diários ainda não marcados hoje — o que sobrou de "Missões de
  // hoje" na prática, só que agora vindo do sistema de Hábitos.
  $: pendingHabits = ($habits ?? [])
    .filter((h) => h.cadence === 'daily' && !completedToday(h.id, $completions ?? []))
    .slice(0, 2);

  // JS getDay(): 0=domingo...6=sábado. Convertendo pro formato usado em
  // WEEKDAYS ('seg'..'dom') pra achar o próximo treino agendado.
  const dayCodes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  $: nextWorkout = (() => {
    const scheduled = ($plans ?? []).filter((p) => p.weekday);
    if (scheduled.length === 0) return null;

    const todayIdx = new Date().getDay();
    for (let i = 0; i < 7; i++) {
      const code = dayCodes[(todayIdx + i) % 7];
      const match = scheduled.find((p) => p.weekday === code);
      if (match) return { plan: match, inDays: i };
    }
    return null;
  })();

  function weekdayLabel(value) {
    return WEEKDAYS.find((w) => w.value === value)?.label ?? '';
  }

  async function completeHabit(habit) {
    if (completedToday(habit.id, $completions ?? [])) return;

    await db.habitCompletions.add({ habitId: habit.id, date: todayIso() });

    const current = await db.player.toCollection().first();
    const { level, xp, leveledUp } = applyXp(current.level, current.xp, habit.xpReward ?? 10);
    await db.player.update(current.id, { level, xp });

    if (leveledUp) {
      alert(`Level up! Agora você é nível ${level} 🎉`);
    }
  }
</script>

<main class="min-h-screen p-6 pb-24 flex flex-col gap-6 max-w-md mx-auto">
  {#if $player}
    <div>
      <p class="text-sm text-white/50">Olá{$player.name ? `, ${$player.name}` : ''} 👋</p>
      <h1 class="text-2xl font-bold text-primary">Início</h1>
    </div>

    <StatsBar level={$player.level} xp={$player.xp} {streak} />
  {/if}

  <StreakCalendar days={weekActivity} {streak} />

  <!-- Próximas ações: une o próximo treino agendado e os hábitos do dia
       ainda pendentes num único carrossel horizontal, em vez de dois
       cards competindo pela mesma atenção. -->
  {#if nextWorkout || pendingHabits.length > 0}
    <div>
      <h2 class="text-sm uppercase text-white/40 mb-3">Próximas ações</h2>
      <div class="flex gap-3 overflow-x-auto pb-1">
        {#if nextWorkout}
          <button
            class="shrink-0 w-44 bg-surface rounded-xl p-4 text-left"
            on:click={() => navigate('workout-plan-detail', { planId: nextWorkout.plan.id })}
          >
            <span class="text-xl block mb-2">💪</span>
            <p class="text-sm font-semibold truncate">{nextWorkout.plan.name}</p>
            <p class="text-xs text-white/40 mt-1">
              {nextWorkout.inDays === 0 ? 'Hoje' : weekdayLabel(nextWorkout.plan.weekday)}
              {#if nextWorkout.plan.estimatedDuration}· ~{nextWorkout.plan.estimatedDuration} min{/if}
            </p>
          </button>
        {/if}

        {#each pendingHabits as habit (habit.id)}
          <button class="shrink-0 w-44 bg-surface rounded-xl p-4 text-left" on:click={() => completeHabit(habit)}>
            <span class="text-xl block mb-2">{habit.icon ?? '🔥'}</span>
            <p class="text-sm font-semibold truncate">{habit.title}</p>
            <p class="text-xs text-xp mt-1">+{habit.xpReward ?? 10} XP · toque p/ concluir</p>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <button class="text-xs text-white/40 text-left -mt-3" on:click={() => navigate('habits')}>
    Ver todos os hábitos →
  </button>
</main>
