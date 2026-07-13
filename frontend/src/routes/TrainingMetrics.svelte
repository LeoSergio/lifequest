<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import BarChart from '../components/BarChart.svelte';
  import RadarChart from '../components/RadarChart.svelte';
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import { maxWeightByDay, weeklyCalendar, currentStreak } from '../lib/metrics.js';

  // Vindo de um link contextual em WorkoutPlanDetail (ex: "ver evolução
  // de carga" depois de terminar um treino) — se presente, a aba de
  // Desempenho já abre com esse exercício selecionado.
  export let focusExerciseId = null;

  let tab = focusExerciseId ? 'desempenho' : 'perimetricas'; // perimetricas | desempenho | consistencia

  // ---------- Perimétricas ----------
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

  $: radarData = latestMeasurement
    ? {
        labels: ['Ombro', 'Tórax', 'Abdômen', 'Coxa', 'Panturrilha', 'Braço E', 'Braço D', 'Antebraço'],
        data: [
          latestMeasurement.shoulder ?? 0,
          latestMeasurement.chest ?? 0,
          latestMeasurement.abdomen ?? 0,
          latestMeasurement.thigh ?? 0,
          latestMeasurement.calf ?? 0,
          latestMeasurement.armLeft ?? 0,
          latestMeasurement.armRight ?? 0,
          latestMeasurement.forearm ?? 0
        ]
      }
    : null;

  // Peso ao longo do tempo — já tínhamos o histórico completo em
  // bodyMeasurements, só não existia nenhum gráfico usando ele (só o
  // "retrato" mais recente aparecia, no radar).
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

  // ---------- Desempenho (carga por exercício) ----------
  // Antes isso vinha de workoutPlanExercises, o que fazia o histórico
  // sumir do dropdown se o plano fosse apagado. Agora vem do catálogo
  // `exercises`, que é estável — e sessionSets guarda exerciseId direto
  // (ver migração v5 em db.js), então o dado não depende do plano.
  const catalog = liveQuery(() => db.exercises.toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  let selectedExercise = focusExerciseId ?? null;

  // Exercícios com histórico de sessão aparecem primeiro — assim a
  // pessoa não precisa abrir 4 exercícios vazios até achar um com dado.
  $: exerciseOptions = ($catalog ?? [])
    .map((e) => ({
      ...e,
      hasData: ($allSessionSets ?? []).some((s) => s.exerciseId === e.id)
    }))
    .sort((a, b) => Number(b.hasData) - Number(a.hasData) || a.name.localeCompare(b.name));

  $: if (selectedExercise == null && exerciseOptions.length > 0) selectedExercise = exerciseOptions[0].id;

  $: performanceData =
    selectedExercise != null && $allSessionSets
      ? maxWeightByDay($allSessionSets.filter((s) => s.exerciseId === selectedExercise))
      : { labels: [], data: [] };

  $: selectedExerciseName = exerciseOptions.find((e) => e.id === selectedExercise)?.name ?? '';

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
    {#each [['perimetricas', 'Perimétricas'], ['desempenho', 'Desempenho'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'perimetricas'}
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
        <div class="bg-surface rounded-xl p-4 mb-3">
          <p class="text-xs text-white/40 mb-2">Peso ao longo do tempo</p>
          <LineChart labels={weightTrend.labels} data={weightTrend.data} label="Peso (kg)" />
        </div>
      {/if}

      {#if radarData}
        <div class="bg-surface rounded-xl p-4 mb-4">
          <RadarChart labels={radarData.labels} data={radarData.data} label="cm (última medição)" />
        </div>
      {:else}
        <p class="text-sm text-white/40 mb-4">Registre sua primeira medição abaixo para ver o gráfico.</p>
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

        <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium text-sm">Registrar medição</button>
      </form>
    </section>
  {:else if tab === 'desempenho'}
    <section>
      {#if exerciseOptions.length === 0}
        <p class="text-sm text-white/40">Cadastre exercícios em um treino para ver a evolução de carga aqui.</p>
      {:else}
        <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-3" bind:value={selectedExercise}>
          {#each exerciseOptions as ex}
            <option value={ex.id}>{ex.name}{ex.hasData ? '' : ' (sem dados ainda)'}</option>
          {/each}
        </select>

        <div class="bg-surface rounded-xl p-4">
          {#if performanceData.labels.length === 0}
            <p class="text-sm text-white/40">
              Ainda sem sessões registradas para "{selectedExerciseName}". Esse gráfico se preenche quando você
              começar a executar os treinos e registrar peso/reps.
            </p>
          {:else}
            <BarChart labels={performanceData.labels} data={performanceData.data} label="{selectedExerciseName} (kg)" />
          {/if}
        </div>
      {/if}
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
