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

<div class="bg-surface rounded-xl p-4">
  <div class="flex justify-between items-center mb-3">
    <h2 class="text-sm uppercase text-white/40">Resumo</h2>
    <div class="flex bg-bg rounded-lg p-0.5 text-[11px]">
      {#each [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre']] as [value, label]}
        <button
          class="px-2.5 py-1 rounded-md transition-colors {period === value ? 'bg-primary text-white' : 'text-white/40'}"
          on:click={() => (period = value)}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>

  {#if weightTrend}
    <div class="mb-3">
      <div class="flex items-baseline gap-2 mb-1">
        <span class="text-lg font-bold {toneClass[weightTone]}">
          {weightTrend.delta > 0 ? '+' : ''}{weightTrend.delta}kg
        </span>
        <span class="text-xs text-white/40">no período · agora {weightTrend.last}kg</span>
      </div>
      <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
    </div>
  {/if}

  <div class="grid grid-cols-3 gap-2">
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{workouts}</p>
      <p class="text-[10px] text-white/40">treinos</p>
    </div>
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{habitRate != null ? `${habitRate}%` : '-'}</p>
      <p class="text-[10px] text-white/40">hábitos</p>
    </div>
    <div class="bg-bg rounded-lg p-2 text-center">
      <p class="text-base font-bold">{goalsAchieved}</p>
      <p class="text-[10px] text-white/40">metas batidas</p>
    </div>
  </div>

  {#if !weightTrend}
    <p class="text-[11px] text-white/30 mt-3">
      Registre pelo menos 2 medições de peso no período (em Treino → Métricas) pra ver a tendência aqui.
    </p>
  {/if}
</div>
