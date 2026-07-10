<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import LineChart from '../components/LineChart.svelte';
  import BarChart from '../components/BarChart.svelte';
  import RadarChart from '../components/RadarChart.svelte';
  import { sessionsPerWeek, maxWeightByDay } from '../lib/metrics.js';

  // ---------- Perimétricas ----------
  let date = new Date().toISOString().slice(0, 10);

  // Perfil — escalas diferentes das circunferências, não entram no radar
  let age = '';
  let weight = '';
  let height = '';

  // Circunferências — todas em cm, comparáveis entre si no radar
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
  const planExercises = liveQuery(() => db.workoutPlanExercises.toArray());

  // Vários registros de workoutPlanExercises podem ter o mesmo nome
  // (o mesmo exercício em treinos diferentes) — juntamos pelo nome
  // pra não fragmentar o histórico de carga em gráficos separados.
  $: exerciseNames = $planExercises ? [...new Set($planExercises.map((e) => e.exerciseName))] : [];

  let selectedExercise = '';
  $: if (!selectedExercise && exerciseNames.length > 0) selectedExercise = exerciseNames[0];

  $: matchingIds = $planExercises
    ? $planExercises.filter((e) => e.exerciseName === selectedExercise).map((e) => e.id)
    : [];

  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  $: performanceData =
    matchingIds.length > 0 && $allSessionSets
      ? maxWeightByDay($allSessionSets.filter((s) => matchingIds.includes(s.workoutPlanExerciseId)))
      : { labels: [], data: [] };

  // ---------- Consistência ----------
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  $: consistencyData = $sessions ? sessionsPerWeek($sessions, 8) : { labels: [], data: [] };
</script>

<main class="min-h-screen p-6 pb-24 max-w-md mx-auto">
  <button class="text-sm text-white/40 mb-4" on:click={() => navigate('training')}>← Treinos</button>
  <h1 class="text-2xl font-bold text-primary mb-6">Métricas</h1>

  <!-- Perimétricas -->
  <section class="mb-8">
    <h2 class="text-sm uppercase text-white/40 mb-3">Perimétricas</h2>

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

  <!-- Desempenho -->
  <section class="mb-8">
    <h2 class="text-sm uppercase text-white/40 mb-3">Desempenho</h2>

    {#if exerciseNames.length === 0}
      <p class="text-sm text-white/40">Cadastre exercícios em um treino para ver a evolução de carga aqui.</p>
    {:else}
      <select class="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm mb-3" bind:value={selectedExercise}>
        {#each exerciseNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>

      <div class="bg-surface rounded-xl p-4">
        {#if performanceData.labels.length === 0}
          <p class="text-sm text-white/40">
            Ainda sem sessões registradas para "{selectedExercise}". Esse gráfico se preenche quando você
            começar a executar os treinos e registrar peso/reps.
          </p>
        {:else}
          <BarChart labels={performanceData.labels} data={performanceData.data} label="{selectedExercise} (kg)" />
        {/if}
      </div>
    {/if}
  </section>

  <!-- Consistência -->
  <section>
    <h2 class="text-sm uppercase text-white/40 mb-3">Consistência</h2>
    <div class="bg-surface rounded-xl p-4">
      {#if $sessions && $sessions.length === 0}
        <p class="text-sm text-white/40">
          Nenhuma sessão de treino concluída ainda — esse gráfico mostra quantos treinos você fecha por semana.
        </p>
      {:else}
        <LineChart labels={consistencyData.labels} data={consistencyData.data} label="Treinos por semana" />
      {/if}
    </div>
  </section>
</main>
