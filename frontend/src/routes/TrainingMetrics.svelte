<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { navigate } from '../lib/nav.js';
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import {
    weeklyCalendar,
    currentStreak,
    buildPeriodBuckets,
    bucketSeries,
    totalTonnage,
    totalSetCount,
    totalReps,
    computePRs,
    percentDelta,
    tonnageByMuscleGroup
  } from '../lib/metrics.js';

  let tab = 'desempenho'; // perimetria | desempenho | consistencia

  // ---------- Perimetria ----------
  // Redesenhada a partir do zero: em vez do radar de circunferências (que
  // ninguém conseguia ler de cara), a tela agora segue o modelo "última
  // atualização + evolução do peso + cadastro" — mostra primeiro o que
  // mudou desde a medição anterior (com seta/cor), depois o gráfico, só
  // então o formulário. A aba de fotos foi propositalmente deixada de fora.
  const measurements = liveQuery(() => db.bodyMeasurements.orderBy('date').toArray());
  const players = liveQuery(() => db.player.toArray());
  $: player = $players?.[0] || null;

  $: latestMeasurement = $measurements && $measurements.length > 0 ? $measurements[$measurements.length - 1] : null;
  $: previousMeasurement = $measurements && $measurements.length > 1 ? $measurements[$measurements.length - 2] : null;

  function arm(m) {
    if (!m) return null;
    if (m.armLeft == null && m.armRight == null) return null;
    const vals = [m.armLeft, m.armRight].filter((v) => v != null);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // Conjunto de métricas mostrado no resumo, na mesma ordem/nomenclatura
  // da referência: Peso, Cintura, Peitoral, Braço, Coxa, Panturrilha, %
  // Gordura. "Cintura" e "Peitoral" reaproveitam os campos já existentes
  // (abdomen/chest) só com o rótulo em português mais comum.
  $: summaryRows = latestMeasurement
    ? [
        { label: 'Peso', unit: 'kg', value: latestMeasurement.weight, previous: previousMeasurement?.weight },
        { label: 'Cintura', unit: 'cm', value: latestMeasurement.abdomen, previous: previousMeasurement?.abdomen },
        { label: 'Peitoral', unit: 'cm', value: latestMeasurement.chest, previous: previousMeasurement?.chest },
        { label: 'Braço', unit: 'cm', value: arm(latestMeasurement), previous: arm(previousMeasurement) },
        { label: 'Coxa', unit: 'cm', value: latestMeasurement.thigh, previous: previousMeasurement?.thigh },
        { label: 'Panturrilha', unit: 'cm', value: latestMeasurement.calf, previous: previousMeasurement?.calf },
        { label: '% Gordura', unit: '%', value: latestMeasurement.bodyFatPercent, previous: previousMeasurement?.bodyFatPercent }
      ].map((row) => {
        const delta =
          row.value != null && row.previous != null ? Math.round((row.value - row.previous) * 10) / 10 : null;
        return { ...row, delta };
      })
    : [];

  // Peso dos últimos 30 dias — igual à referência ("Evolução do peso —
  // últimos 30 dias"). Usa só os registros com peso preenchido.
  $: weightTrend30d = (() => {
    if (!$measurements) return { labels: [], data: [] };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const recent = $measurements.filter((m) => m.weight != null && m.date >= cutoffIso);
    return {
      labels: recent.map((m) => m.date.slice(5).split('-').reverse().join('/')),
      data: recent.map((m) => m.weight)
    };
  })();

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

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
  let bodyFatPercent = '';

  function toNumberOrNull(value) {
    return value === '' || value == null ? null : Number(value);
  }

  // Preenche os campos do formulário com os dados da última medição para facilitar
  $: if (latestMeasurement) {
    if (age === '' && latestMeasurement.age != null) age = latestMeasurement.age;
    if (weight === '' && latestMeasurement.weight != null) weight = latestMeasurement.weight;
    if (height === '' && latestMeasurement.height != null) height = latestMeasurement.height;
    if (shoulder === '' && latestMeasurement.shoulder != null) shoulder = latestMeasurement.shoulder;
    if (chest === '' && latestMeasurement.chest != null) chest = latestMeasurement.chest;
    if (abdomen === '' && latestMeasurement.abdomen != null) abdomen = latestMeasurement.abdomen;
    if (thigh === '' && latestMeasurement.thigh != null) thigh = latestMeasurement.thigh;
    if (calf === '' && latestMeasurement.calf != null) calf = latestMeasurement.calf;
    if (armLeft === '' && latestMeasurement.armLeft != null) armLeft = latestMeasurement.armLeft;
    if (armRight === '' && latestMeasurement.armRight != null) armRight = latestMeasurement.armRight;
    if (forearm === '' && latestMeasurement.forearm != null) forearm = latestMeasurement.forearm;
    if (bodyFatPercent === '' && latestMeasurement.bodyFatPercent != null) bodyFatPercent = latestMeasurement.bodyFatPercent;
  }

  // ---------- Calculadora de Calorias ----------
  let calcGender = 'M';
  let calcActivity = 1.375; // Levemente ativo
  let calcGoal = 'maintain';
  let goalSynced = false;

  $: if (player && !goalSynced) {
    if (player.goal === 'weight_loss') calcGoal = 'lose';
    else if (player.goal === 'hypertrophy') calcGoal = 'gain';
    else calcGoal = 'maintain';
    goalSynced = true;
  }

  $: targetCalories = (() => {
    const w = toNumberOrNull(weight);
    const h = toNumberOrNull(height);
    const a = toNumberOrNull(age);
    if (!w || !h || !a) return null;
    
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += calcGender === 'M' ? 5 : -161;
    
    let tdee = bmr * calcActivity;
    if (calcGoal === 'lose') return Math.round(tdee - 500);
    if (calcGoal === 'gain') return Math.round(tdee + 500);
    return Math.round(tdee);
  })();

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
      forearm: toNumberOrNull(forearm),
      bodyFatPercent: toNumberOrNull(bodyFatPercent)
    });

    age = weight = height = shoulder = chest = abdomen = thigh = calf = armLeft = armRight = forearm = bodyFatPercent = '';
  }

  // ---------- Desempenho (Carga / Volume / Repetições / PRs) ----------
  // Redesenhado: em vez de escolher um treino e ver um gráfico por
  // exercício, agora é um dashboard único parecido com apps de treino de
  // mercado — 4 métricas (Carga, Volume, Repetições, PRs), cada uma com
  // filtro de período (7/30/60 dias ou Tudo) e o total do período com a
  // variação % contra o período anterior de mesmo tamanho. Abaixo, a
  // tonelagem levantada por grupo muscular.
  const catalog = liveQuery(() => db.exercises.toArray());
  const allSessionSets = liveQuery(() => db.sessionSets.toArray());

  let metric = 'carga'; // carga | volume | repeticoes | prs
  let period = 30; // 7 | 30 | 60 | null (Tudo)

  const METRIC_CONFIG = {
    carga: { label: 'Carga', chartTitle: 'Evolução de Carga (kg)', totalLabel: 'Total levantado', unit: 'kg' },
    volume: { label: 'Volume', chartTitle: 'Evolução de Volume (séries)', totalLabel: 'Total de séries', unit: '' },
    repeticoes: { label: 'Repetições', chartTitle: 'Evolução de Repetições', totalLabel: 'Total de repetições', unit: '' },
    prs: { label: 'PRs', chartTitle: 'Evolução de PRs', totalLabel: 'Recordes pessoais', unit: '' }
  };

  // PRs precisam do histórico completo pra saber o que é recorde — só
  // depois disso filtramos pelo período escolhido, junto com as outras
  // métricas.
  $: prSets = $allSessionSets ? computePRs($allSessionSets) : [];

  $: valueFn =
    metric === 'carga'
      ? totalTonnage
      : metric === 'volume'
        ? totalSetCount
        : metric === 'repeticoes'
          ? totalReps
          : (sets) => sets.length; // prs: os próprios "sets" já vêm filtrados de prSets

  $: sourceSets = metric === 'prs' ? prSets : ($allSessionSets ?? []);

  $: buckets = $allSessionSets ? buildPeriodBuckets(sourceSets, period) : [];
  $: chartSeries = buckets.length > 0 ? bucketSeries(sourceSets, buckets, valueFn) : { labels: [], data: [] };

  $: periodTotal = chartSeries.data.reduce((a, b) => a + b, 0);

  // Variação vs período anterior de mesmo tamanho — só faz sentido pra
  // períodos fixos (7/30/60 dias); em "Tudo" não existe "período anterior".
  $: previousTotal = (() => {
    if (period == null || buckets.length === 0) return null;
    const spanDays = period;
    const currentStart = new Date(buckets[0].start);
    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - spanDays);
    const prevEnd = currentStart.toISOString().slice(0, 10);
    const prevStartIso = prevStart.toISOString().slice(0, 10);
    const prevSets = sourceSets.filter((s) => s.completedAt >= prevStartIso && s.completedAt < prevEnd);
    return valueFn(prevSets);
  })();

  $: deltaPercent = previousTotal != null ? percentDelta(periodTotal, previousTotal) : null;

  $: muscleGroups = $allSessionSets && $catalog ? tonnageByMuscleGroup($allSessionSets, $catalog) : [];
  let showAllGroups = false;
  $: visibleGroups = showAllGroups ? muscleGroups : muscleGroups.slice(0, 5);
  $: topGroupKg = muscleGroups.length > 0 ? muscleGroups[0].kg : 0;

  function formatTotal(value, unit) {
    const rounded = Math.round(value * 10) / 10;
    return unit ? `${rounded.toLocaleString('pt-BR')}${unit}` : rounded.toLocaleString('pt-BR');
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
    {#each [['perimetria', 'Perimetria'], ['desempenho', 'Desempenho'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-lg transition-colors {tab === value ? 'bg-primary text-white' : 'text-white/40'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'perimetria'}
    <section>
      {#if latestMeasurement}
        <p class="text-xs text-white/40 mb-2">Última atualização: {formatDate(latestMeasurement.date)}</p>

        <div class="bg-surface rounded-xl p-4 mb-4 flex flex-col gap-3">
          {#each summaryRows as row}
            <div class="flex justify-between items-center text-sm">
              <span class="text-white/60">{row.label}</span>
              <div class="flex items-center gap-3">
                <span class="font-semibold">{row.value != null ? `${row.value}${row.unit}` : '-'}</span>
                {#if row.delta != null && row.delta !== 0}
                  <span class="text-xs {row.delta < 0 ? 'text-xp' : 'text-danger'}">
                    {row.delta > 0 ? '+' : ''}{row.delta}{row.unit}
                  </span>
                {:else if row.delta === 0}
                  <span class="text-xs text-white/30">-</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-white/40 mb-4">Registre sua primeira medição abaixo para ver o resumo aqui.</p>
      {/if}

      <div class="bg-surface rounded-xl p-4 mb-6">
        <p class="text-xs text-white/40 mb-1">Evolução do peso</p>
        <p class="text-xs text-white/30 mb-2">Últimos 30 dias</p>
        {#if weightTrend30d.labels.length >= 2}
          <LineChart labels={weightTrend30d.labels} data={weightTrend30d.data} label="Peso (kg)" />
        {:else}
          <p class="text-sm text-white/40">Registre pelo menos duas medições de peso pra ver a evolução aqui.</p>
        {/if}
      </div>

      <!-- Calculadora de Calorias -->
      <div class="bg-surface rounded-xl p-4 mb-6 shadow-sm border border-white/5">
        <div class="flex justify-between items-center mb-3">
          <p class="text-sm font-semibold">Cálculo de Calorias Diárias</p>
          <span class="text-xl">🔥</span>
        </div>
        
        <p class="text-[11px] text-white/50 mb-4 leading-relaxed">
          Baseado na sua idade, peso e altura (pode alterar no formulário abaixo). Ajuste para seu perfil e objetivo.
        </p>

        <div class="flex flex-col gap-3 mb-4">
          <div class="flex gap-2">
            <button class="flex-1 py-2 text-xs rounded-lg border transition-colors {calcGender === 'M' ? 'bg-primary border-primary text-white' : 'bg-bg border-white/10 text-white/50 hover:bg-white/5'}" on:click={() => calcGender = 'M'}>Masculino</button>
            <button class="flex-1 py-2 text-xs rounded-lg border transition-colors {calcGender === 'F' ? 'bg-primary border-primary text-white' : 'bg-bg border-white/10 text-white/50 hover:bg-white/5'}" on:click={() => calcGender = 'F'}>Feminino</button>
          </div>
          
          <select class="bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white/80 outline-none focus:border-primary transition-colors" bind:value={calcActivity}>
            <option value={1.2}>Sedentário (pouco ou nenhum exercício)</option>
            <option value={1.375}>Levemente ativo (exercício leve 1-3 dias/sem)</option>
            <option value={1.55}>Moderadamente ativo (esporte 3-5 dias/sem)</option>
            <option value={1.725}>Muito ativo (exercício intenso 6-7 dias/sem)</option>
          </select>
          
          <div class="flex gap-2">
            <button class="flex-1 py-2 text-[10px] sm:text-[11px] font-medium rounded-lg border transition-colors {calcGoal === 'lose' ? 'bg-primary border-primary text-white' : 'bg-bg border-white/10 text-white/50 hover:bg-white/5'}" on:click={() => calcGoal = 'lose'}>Perder</button>
            <button class="flex-1 py-2 text-[10px] sm:text-[11px] font-medium rounded-lg border transition-colors {calcGoal === 'maintain' ? 'bg-primary border-primary text-white' : 'bg-bg border-white/10 text-white/50 hover:bg-white/5'}" on:click={() => calcGoal = 'maintain'}>Manter</button>
            <button class="flex-1 py-2 text-[10px] sm:text-[11px] font-medium rounded-lg border transition-colors {calcGoal === 'gain' ? 'bg-primary border-primary text-white' : 'bg-bg border-white/10 text-white/50 hover:bg-white/5'}" on:click={() => calcGoal = 'gain'}>Ganhar</button>
          </div>
        </div>

        {#if targetCalories}
          <div class="flex items-center justify-between bg-bg rounded-lg p-3 border border-primary/20 shadow-[0_0_15px_rgba(124,92,255,0.1)]">
            <span class="text-xs font-medium text-white/80">Sua meta diária:</span>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-xp tracking-tight">{targetCalories}</span>
              <span class="text-[10px] text-white/40 uppercase font-semibold tracking-wider">kcal</span>
            </div>
          </div>
        {:else}
          <div class="text-[11px] text-white/40 text-center bg-bg/50 rounded-lg p-3 border border-white/5">
            Preencha idade, peso e altura no formulário abaixo para gerar o cálculo.
          </div>
        {/if}
      </div>

      <h2 class="text-sm uppercase text-white/40 mb-3">Cadastrar nova perimetria</h2>
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
          <p class="text-xs text-white/40 mb-1">Circunferências (cm) e % de gordura</p>
          <div class="grid grid-cols-2 gap-2">
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Cintura" type="number" bind:value={abdomen} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Peitoral" type="number" bind:value={chest} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Ombro" type="number" bind:value={shoulder} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Coxa" type="number" bind:value={thigh} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Panturrilha" type="number" bind:value={calf} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Antebraço" type="number" bind:value={forearm} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço esquerdo" type="number" bind:value={armLeft} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Braço direito" type="number" bind:value={armRight} />
            <input class="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="% Gordura" type="number" bind:value={bodyFatPercent} />
          </div>
        </div>

        <button type="submit" class="bg-primary text-white rounded-lg py-3 font-medium text-sm">Registrar medição</button>
      </form>
    </section>
  {:else if tab === 'desempenho'}
    <section>
      <div class="flex bg-surface rounded-xl p-1 mb-2 text-xs gap-1">
        {#each Object.entries(METRIC_CONFIG) as [value, config]}
          <button
            class="flex-1 py-2 rounded-lg transition-colors {metric === value ? 'bg-primary text-white' : 'text-white/40'}"
            on:click={() => (metric = value)}
          >
            {config.label}
          </button>
        {/each}
      </div>

      <div class="flex bg-surface rounded-xl p-1 mb-4 text-xs gap-1">
        {#each [[7, '7 dias'], [30, '30 dias'], [60, '60 dias'], [null, 'Tudo']] as [value, label]}
          <button
            class="flex-1 py-2 rounded-lg transition-colors {period === value ? 'bg-primary text-white' : 'text-white/40'}"
            on:click={() => (period = value)}
          >
            {label}
          </button>
        {/each}
      </div>

      <div class="bg-surface rounded-xl p-4 mb-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <p class="text-sm font-semibold mb-1">{METRIC_CONFIG[metric].chartTitle}</p>
            <p class="text-xs text-white/40">{METRIC_CONFIG[metric].totalLabel}</p>
          </div>
          <div class="text-right">
            <p class="font-semibold">{formatTotal(periodTotal, METRIC_CONFIG[metric].unit)}</p>
            {#if deltaPercent != null}
              <p class="text-xs {deltaPercent >= 0 ? 'text-xp' : 'text-danger'}">
                {deltaPercent > 0 ? '+' : ''}{deltaPercent}% vs período anterior
              </p>
            {/if}
          </div>
        </div>

        {#if chartSeries.labels.length === 0 || periodTotal === 0}
          <p class="text-sm text-white/40">
            Ainda sem dados de {METRIC_CONFIG[metric].label.toLowerCase()} nesse período. Registre peso/reps nos seus
            treinos pra ver a evolução aqui.
          </p>
        {:else}
          <LineChart labels={chartSeries.labels} data={chartSeries.data} label={METRIC_CONFIG[metric].label} />
        {/if}
      </div>

      <div class="bg-surface rounded-xl p-4">
        <p class="text-sm font-semibold mb-3">Grupos musculares</p>
        {#if muscleGroups.length === 0}
          <p class="text-sm text-white/40">Cadastre exercícios com grupo muscular pra ver essa distribuição.</p>
        {:else}
          <div class="flex flex-col gap-3">
            {#each visibleGroups as g (g.group)}
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-white/60">{g.group}</span>
                  <span class="text-white/40">{(g.kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton</span>
                </div>
                <div class="w-full h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary rounded-full"
                    style="width: {topGroupKg > 0 ? Math.max(4, (g.kg / topGroupKg) * 100) : 0}%"
                  />
                </div>
              </div>
            {/each}
          </div>

          {#if muscleGroups.length > 5}
            <button
              class="w-full text-xs text-primary mt-3"
              on:click={() => (showAllGroups = !showAllGroups)}
            >
              {showAllGroups ? 'Ver menos' : 'Ver detalhes'}
            </button>
          {/if}
        {/if}
      </div>
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
