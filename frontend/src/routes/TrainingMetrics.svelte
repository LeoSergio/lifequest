<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import BarChart from '../components/BarChart.svelte';
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import { maxWeightByMonth, weeklyCalendar, currentStreak } from '../lib/metrics.js';

  // Vindo de "ver evolução deste treino" em WorkoutPlanDetail — se
  // presente, a aba de Desempenho já abre com esse treino selecionado.
  export let focusPlanId = null;

  let tab = 'desempenho'; // desempenho | perimetricas | consistencia

  // ---------- Desempenho (por treino, agrupado por mês) ----------
  // Antes isso era um dropdown achatado com TODO exercício de TODO
  // plano, e o link contextual tinha que "adivinhar" qual exercício
  // abrir (bug: sempre abria o primeiro da lista, então "Supino Reto"
  // podia aparecer vazio se não fosse o primeiro exercício do treino).
  // Agora escolhe-se o TREINO, e a tela mostra todos os exercícios dele
  // de uma vez — sem adivinhação nenhuma.
  const plans = liveQuery(() => db.workoutPlans.toArray());
  const allLinks = liveQuery(() => db.workoutPlanExercises.toArray());
  const catalog = liveQuery(() => db.exercises.toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  let selectedPlan = focusPlanId;

  $: if (selectedPlan == null && $plans && $plans.length > 0) selectedPlan = $plans[0].id;

  $: planExercises = ($allLinks ?? [])
    .filter((l) => l.workoutPlanId === selectedPlan)
    .sort((a, b) => a.order - b.order)
    .map((link) => ({
      ...link,
      exercise: ($catalog ?? []).find((e) => e.id === link.exerciseId) ?? { name: '(exercício removido)' },
      chart: $allSessionSets
        ? maxWeightByMonth($allSessionSets.filter((s) => s.exerciseId === link.exerciseId))
        : { labels: [], data: [] }
    }));

  // ---------- Perimétricas ----------
  // O gráfico de radar das circunferências saiu daqui: apontaram que não
  // era intuitivo. Ficam só os números da última medição e a evolução de
  // peso (um gráfico de linha simples, que é bem mais direto de ler).
  let date = new Date().toISOString().slice(0, 10);

  let age = '';
  let weight = '';
  let height = '';

  let shoulder = '';
  let chest = '';
  let abdomen = '';
  let thigh = '';
  let calf = '';
  let armLeft = '';
  let armRight = '';
  let forearm = '';

  const measurements = liveQuery(() => db.bodyMeasurements.orderBy('date').toArray());

  $: latestMeasurement = $measurements && $measurements.length > 0 ? $measurements[$measurements.length - 1] : null;

  $: weightTrend = $measurements
    ? {
        labels: $measurements.filter((m) => m.weight != null).map((m) => m.date.slice(5).split('-').reverse().join('/')),
        data: $measurements.filter((m) => m.weight != null).map((m) => m.weight)
      }
    : { labels: [], data: [] };

  function toNumberOrNull(value) {
    return value === '' ? null : Number(value);
  }

  async function addMeasurement() {
    await db.bodyMeasurements.add({
      date,
      age: toNumberOrNull(age),
      weight: toNumberOrNull(weight),
      height: toNumberOrNull(height),
      shoulder: toNumberOrNull(shoulder),
      chest: toNumberOrNull(chest),
      abdomen: toNumberOrNull(abdomen),
      thigh: toNumberOrNull(thigh),
      calf: toNumberOrNull(calf),
      armLeft: toNumberOrNull(armLeft),
      armRight: toNumberOrNull(armRight),
      forearm: toNumberOrNull(forearm)
    });

    age = weight = height = shoulder = chest = abdomen = thigh = calf = armLeft = armRight = forearm = '';
  }

  // ---------- Consistência ----------
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  $: calendarColumns = $sessions ? weeklyCalendar($sessions, 9) : [];
  $: totalTrained = $sessions ? new Set($sessions.filter((s) => s.finishedAt).map((s) => s.finishedAt.slice(0, 10))).size : 0;
  $: streak = $sessions ? currentStreak($sessions) : 0;
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <button class="text-sm text-white/40 mb-4" on:click={() => navigate('training')}>← Treinos</button>
  <h1 class="text-2xl font-bold text-primary mb-4">Métricas</h1>

  <div class="flex bg-surface rounded-xl p-1 mb-6 text-xs">
    {#each [['desempenho', 'Desempenho'], ['perimetricas', 'Perimétricas'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'desempenho'}
    <section>
      {#if $plans === undefined || $plans.length === 0}
        <p class="text-sm text-white/40">Crie um treino em Treinos para ver a evolução de carga aqui.</p>
      {:else}
        <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-4" bind:value={selectedPlan}>
          {#each $plans as plan}
            <option value={plan.id}>{plan.name}</option>
          {/each}
        </select>

        {#if planExercises.length === 0}
          <p class="text-sm text-white/40">Esse treino ainda não tem exercícios cadastrados.</p>
        {:else}
          <div class="flex flex-col gap-4">
            {#each planExercises as pe (pe.id)}
              <div class="bg-surface rounded-xl p-4">
                <p class="text-sm font-semibold mb-2">{pe.exercise.name}</p>
                {#if pe.chart.data.every((v) => v == null)}
                  <p class="text-xs text-white/40">
                    Ainda sem sessões registradas para esse exercício. O gráfico se preenche quando você
                    treinar e registrar peso/reps.
                  </p>
                {:else}
                  <BarChart labels={pe.chart.labels} data={pe.chart.data} label="{pe.exercise.name} (kg/mês)" />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </section>
  {:else if tab === 'perimetricas'}
    <section>
      {#if latestMeasurement}
        <div class="bg-surface rounded-xl p-4 mb-3 flex justify-around text-center">
          <div>
            <p class="text-xs text-white/40">Idade</p>
            <p class="font-semibold">{latestMeasurement.age ?? '-'}</p>
          </div>
          <div>
            <p class="text-xs text-white/40">Peso</p>
            <p class="font-semibold">{latestMeasurement.weight ? `${latestMeasurement.weight}kg` : '-'}</p>
          </div>
          <div>
            <p class="text-xs text-white/40">Altura</p>
            <p class="font-semibold">{latestMeasurement.height ? `${latestMeasurement.height}cm` : '-'}</p>
          </div>
        </div>
      {/if}

      {#if weightTrend.labels.length >= 2}
        <div class="bg-surface rounded-xl p-4 mb-4">
          <p class="text-xs text-white/40 mb-2">Peso ao longo do tempo</p>
          <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
        </div>
      {/if}

      <form on:submit|preventDefault={addMeasurement} class="bg-surface rounded-xl p-4 flex flex-col gap-3">
        <input type="date" class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" bind:value={date} />

        <div>
          <p class="text-xs text-white/40 mb-1">Perfil</p>
          <div class="grid grid-cols-3 gap-2">
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Idade" type="number" bind:value={age} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Peso (kg)" type="number" bind:value={weight} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Altura (cm)" type="number" bind:value={height} />
          </div>
        </div>

        <div>
          <p class="text-xs text-white/40 mb-1">Circunferências (cm)</p>
          <div class="grid grid-cols-2 gap-2">
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Ombro" type="number" bind:value={shoulder} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Tórax" type="number" bind:value={chest} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Abdômen" type="number" bind:value={abdomen} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Coxa" type="number" bind:value={thigh} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Panturrilha" type="number" bind:value={calf} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Antebraço" type="number" bind:value={forearm} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço esquerdo" type="number" bind:value={armLeft} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço direito" type="number" bind:value={armRight} />
          </div>
        </div>

        {#if latestMeasurement}
          <p class="text-[11px] text-white/30">
            Última medição ({latestMeasurement.date}): ombro {latestMeasurement.shoulder ?? '-'}cm · tórax {latestMeasurement.chest ?? '-'}cm ·
            abdômen {latestMeasurement.abdomen ?? '-'}cm · coxa {latestMeasurement.thigh ?? '-'}cm
          </p>
        {/if}

        <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium text-sm">Registrar medição</button>
      </form>
    </section>
  {:else}
    <section>
      <div class="bg-surface rounded-xl p-4">
        {#if $sessions && $sessions.length === 0}
          <p class="text-sm text-white/40">
            Nenhuma sessão de treino concluída ainda — esse calendário marca em quais dias você treinou.
          </p>
        {:else}
          <ConsistencyCalendar columns={calendarColumns} {totalTrained} {streak} />
        {/if}
      </div>
    </section>
  {/if}
</main>
