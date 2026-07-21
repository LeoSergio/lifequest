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
  import PeriodSummary from '../components/PeriodSummary.svelte';

  const player = liveQuery(() => db.player.toCollection().first());
  const habits = liveQuery(() => db.habits.where('archivedAt').equals(null).toArray());
  const completions = liveQuery(() => db.habitCompletions.toArray());
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  const plans = liveQuery(() => db.workoutPlans.toArray());
  const measurements = liveQuery(() => db.bodyMeasurements.toArray());
  const goals = liveQuery(() => db.goals.toArray());

  // Streak global de atividade baseado no login/abertura diária
  // e persistido no db.player para não perder o progresso.
  $: streak = $player?.streak || 0;
  $: weekActivity = $sessions ? last7DaysActivity($sessions) : [];

  import { onMount } from 'svelte';

  onMount(async () => {
    // Atualizar o Streak Global (Dias Consecutivos usando o App)
    const p = await db.player.toCollection().first();
    if (p) {
      const today = todayIso();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().slice(0, 10);

      let newStreak = p.streak || 0;
      let lastActive = p.lastActiveAt;

      if (lastActive !== today) {
        if (lastActive === yesterday) {
          // Entrou ontem e hoje, continua a ofensiva!
          newStreak += 1;
        } else {
          // Perdeu a ofensiva (ficou 1 ou mais dias sem abrir)
          newStreak = 1;
        }
        
        // Persiste no banco de dados local
        await db.player.update(p.id, {
          streak: newStreak,
          lastActiveAt: today
        });
      }
    }
  });

  // Hábitos diários ainda não marcados hoje — o que sobrou de "Missões de
  // hoje" na prática, só que agora vindo do sistema de Hábitos.
  $: pendingHabits = ($habits ?? [])
    .filter((h) => h.cadence === 'daily' && !completedToday(h.id, $completions ?? []))
    .slice(0, 2);

  // JS getDay(): 0=domingo...6=sábado. Convertendo pro formato usado em
  // WEEKDAYS ('seg'..'dom') pra achar o próximo treino agendado.
  const dayCodes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  $: nextWorkout = (() => {
    const scheduled = ($plans ?? []).filter((p) => p.weekday || (p.weekdays && p.weekdays.length > 0));
    if (scheduled.length === 0) return null;

    const todayIdx = new Date().getDay();
    for (let i = 0; i < 7; i++) {
      const code = dayCodes[(todayIdx + i) % 7];
      const match = scheduled.find((p) => p.weekday === code || (p.weekdays && p.weekdays.includes(code)));
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

<main class="min-h-screen p-4 pb-24 flex flex-col gap-4 max-w-md mx-auto">
  {#if $player}
    <div class="flex justify-between items-center px-2 mb-2">
      <div>
        <p class="text-sm text-white/70">Olá{$player.name ? `, ${$player.name}` : ''} 👋</p>
        <h1 class="text-3xl font-bold text-white mt-0.5 tracking-tight">Início</h1>
        <p class="text-xs text-white/50 mt-1">Foco hoje, resultado sempre.</p>
      </div>
      <div class="flex gap-2">
        <button class="w-10 h-10 rounded-full bg-surface/80 border border-white/5 flex items-center justify-center text-white/70 hover:bg-white/5 transition-colors">
          🔔
        </button>
        <button class="w-10 h-10 rounded-full bg-surface/80 border border-white/5 flex items-center justify-center text-white/70 hover:bg-white/5 transition-colors">
          👤
        </button>
      </div>
    </div>

    <StatsBar level={$player.level} xp={$player.xp} {streak} />
  {/if}

  <StreakCalendar days={weekActivity} {streak} />

  <PeriodSummary
    sessions={$sessions ?? []}
    habits={$habits ?? []}
    completions={$completions ?? []}
    measurements={$measurements ?? []}
    goals={$goals ?? []}
    playerGoal={$player?.goal}
  />

  <!-- Ações rápidas -->
  <div class="px-1 mt-1">
    <h2 class="text-sm font-bold text-white mb-3">Ações rápidas</h2>
    <div class="grid grid-cols-4 gap-2">
      <button class="bg-surface/80 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors aspect-square" on:click={() => navigate('training')}>
        <span class="text-primary text-2xl drop-shadow-[0_0_5px_rgba(124,92,255,0.4)]">💪</span>
        <span class="text-[9px] text-white/60 text-center leading-tight">Iniciar<br>treino</span>
      </button>
      <button class="bg-surface/80 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors aspect-square" on:click={() => navigate('pantry')}>
        <span class="text-xp text-2xl drop-shadow-[0_0_5px_rgba(255,177,0,0.4)]">🍎</span>
        <span class="text-[9px] text-white/60 text-center leading-tight">Registrar<br>refeição</span>
      </button>
      <button class="bg-surface/80 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors aspect-square" on:click={() => navigate('training')}>
        <span class="text-cyan-500 text-2xl drop-shadow-[0_0_5px_rgba(6,182,212,0.4)]">⚖️</span>
        <span class="text-[9px] text-white/60 text-center leading-tight">Registrar<br>peso</span>
      </button>
      <button class="bg-surface/80 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors aspect-square" on:click={() => navigate('habits')}>
        <span class="text-green-500 text-2xl drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]">✅</span>
        <span class="text-[9px] text-white/60 text-center leading-tight">Ver<br>hábitos</span>
      </button>
    </div>
  </div>

  <!-- Bottom Banner -->
  <div class="bg-gradient-to-r from-bg to-[#2a1b54] border border-primary/20 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors mt-2 mb-4">
    <div class="flex items-center gap-4">
      <div class="text-4xl filter drop-shadow-[0_0_10px_rgba(124,92,255,0.5)]">🏆</div>
      <div>
        <h3 class="text-[11px] font-bold text-white leading-tight">Pequenas atitudes, grandes conquistas.</h3>
        <p class="text-[10px] text-white/50 mt-1">Você no controle da sua evolução!</p>
      </div>
    </div>
    <span class="text-white/40 text-lg font-light">›</span>
  </div>
</main>
