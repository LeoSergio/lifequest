<script>
  import { periodRange, workoutsInRange, habitsCompletionRateInRange, weightDeltaInRange, goalsAchievedInRange } from '../lib/metrics.js';
  import LineChart from './LineChart.svelte';

  export let sessions = [];
  export let habits = [];
  export let completions = [];
  export let measurements = [];
  export let goals = [];
  export let playerGoal = null; // 'lose_weight' | 'gain_weight' | 'gain_muscle' | 'maintain'

  let period = 'semana'; // semana | mes | trimestre

  $: range = periodRange(period);
  $: workouts = workoutsInRange(sessions, range);
  $: habitRate = habitsCompletionRateInRange(habits, completions, range);
  $: weightTrend = weightDeltaInRange(measurements, range);
  $: goalsAchieved = goalsAchievedInRange(goals, range);

  // No estilo MyFitnessPal: a variação de peso é "boa" ou "ruim" conforme
  // o objetivo escolhido no onboarding, não tem cor fixa.
  $: weightTone = (() => {
    if (!weightTrend) return 'neutral';
    if (playerGoal === 'lose_weight') return weightTrend.delta < 0 ? 'good' : weightTrend.delta > 0 ? 'bad' : 'neutral';
    if (playerGoal === 'gain_weight' || playerGoal === 'gain_muscle') {
      return weightTrend.delta > 0 ? 'good' : weightTrend.delta < 0 ? 'bad' : 'neutral';
    }
    return Math.abs(weightTrend.delta) <= 0.5 ? 'good' : 'neutral'; // manter peso
  })();

  const toneClass = { good: 'text-xp', bad: 'text-danger', neutral: 'text-white/70' };
</script>

<div class="bg-surface/80 border border-white/5 rounded-2xl p-4">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-sm font-bold text-white">Resumo</h2>
    <div class="flex bg-bg rounded-lg p-0.5 text-[10px]">
      {#each [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre']] as [value, label]}
        <button
          class="px-3 py-1.5 rounded-lg transition-colors {period === value ? 'bg-primary/20 text-primary font-semibold' : 'text-white/40 hover:text-white/70'}"
          on:click={() => (period = value)}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-3 gap-2">
    <div class="bg-bg border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
      <span class="text-primary text-xl mb-1 drop-shadow-[0_0_5px_rgba(124,92,255,0.4)]">💪</span>
      <p class="text-2xl font-bold text-white mb-1">{workouts}</p>
      <p class="text-[9px] text-white/50 leading-tight">treinos<br>concluídos</p>
    </div>
    <div class="bg-bg border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
      <span class="text-green-500 text-xl mb-1 drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]">✅</span>
      <p class="text-2xl font-bold text-white mb-1">{habitRate != null ? `${habitRate}` : '-'}</p>
      <p class="text-[9px] text-white/50 leading-tight">hábitos<br>concluídos</p>
    </div>
    <div class="bg-bg border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
      <span class="text-xp text-xl mb-1 drop-shadow-[0_0_5px_rgba(255,177,0,0.4)]">🎯</span>
      <p class="text-2xl font-bold text-white mb-1">{goalsAchieved}</p>
      <p class="text-[9px] text-white/50 leading-tight">metas<br>batidas</p>
    </div>
  </div>

  <div class="flex items-center gap-3 mt-4 px-1 cursor-pointer group">
    <span class="text-primary text-xl group-hover:-translate-y-0.5 transition-transform">📈</span>
    <p class="text-[10px] text-white/40 flex-1 leading-relaxed">
      {#if weightTrend}
        Sua variação de peso no período foi de {weightTrend.delta > 0 ? '+' : ''}{weightTrend.delta}kg. Toque para detalhes.
      {:else}
        Registre pelo menos 2 medições de peso no período (em Treino → Métricas) para ver sua tendência aqui.
      {/if}
    </p>
    <span class="text-white/30 text-xs font-bold">›</span>
  </div>
</div>
