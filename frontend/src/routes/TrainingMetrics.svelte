<script>
  import { liveQuery } from 'dexie';
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { navigate } from '../lib/nav.js';
  import { enqueue, pushSync } from '../services/syncService.js';
  import { showConfirm, showAlert } from '../lib/modal.js';
  import LineChart from '../components/LineChart.svelte';
  import ConsistencyCalendar from '../components/ConsistencyCalendar.svelte';
  import { MUSCLE_GROUPS } from '../lib/constants.js';
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
    tonnageByMuscleGroup,
    filterSetsByMuscleGroup,
    compareMuscleGroupSessions
  } from '../lib/metrics.js';

  export const focusPlanId = null;

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

  let editingId = null;

  function toNumberOrNull(value) {
    return value === '' || value == null ? null : Number(value);
  }

  // Preenche os campos do formulário com os dados da última medição para facilitar
  $: if (latestMeasurement && !editingId) {
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

  async function saveMeasurement() {
    const idToSave = editingId || generateId();
    const item = {
      id: idToSave,
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
    };
    
    await db.bodyMeasurements.put(item);
    await enqueue('upsert', 'bodyMeasurements', item.id, item);
    pushSync().catch(() => {});

    editingId = null;
    age = weight = height = shoulder = chest = abdomen = thigh = calf = armLeft = armRight = forearm = bodyFatPercent = '';
    date = new Date().toISOString().slice(0, 10);
    
    showAlert({ title: 'Sucesso', message: 'Medição salva com sucesso!', icon: '✅', type: 'success' });
  }

  function editLatest() {
    if (!latestMeasurement) return;
    editingId = latestMeasurement.id;
    date = latestMeasurement.date;
    age = latestMeasurement.age ?? '';
    weight = latestMeasurement.weight ?? '';
    height = latestMeasurement.height ?? '';
    shoulder = latestMeasurement.shoulder ?? '';
    chest = latestMeasurement.chest ?? '';
    abdomen = latestMeasurement.abdomen ?? '';
    thigh = latestMeasurement.thigh ?? '';
    calf = latestMeasurement.calf ?? '';
    armLeft = latestMeasurement.armLeft ?? '';
    armRight = latestMeasurement.armRight ?? '';
    forearm = latestMeasurement.forearm ?? '';
    bodyFatPercent = latestMeasurement.bodyFatPercent ?? '';

    setTimeout(() => {
      document.getElementById('perimetria-form-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function deleteLatest() {
    if (!latestMeasurement) return;
    const ok = await showConfirm({
      title: 'Excluir medição?',
      message: 'Tem certeza que deseja remover os dados desta avaliação?',
      icon: '🗑️',
      type: 'danger',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    
    if (ok) {
       await db.bodyMeasurements.delete(latestMeasurement.id);
       await enqueue('delete', 'bodyMeasurements', latestMeasurement.id);
       pushSync().catch(() => {});
    }
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
  let selectedGroup = 'all'; // 'all' ou nome do grupo (ex: 'Peito', 'Costas'...)

  const GROUP_ICONS = {
    all: '🏋️',
    Peito: '🛡️',
    Costas: '🦅',
    Pernas: '🦵',
    Ombro: '⚡',
    'Bíceps': '💪',
    'Tríceps': '🔥',
    Core: '🎯',
    'Glúteos': '🍑',
    'Panturrilha': '👟',
    Outro: '⚡'
  };

  function getGroupIcon(grp) {
    return GROUP_ICONS[grp] || '⚡';
  }

  const METRIC_CONFIG = {
    carga: { label: 'Carga', chartTitle: 'Evolução de Carga (kg)', totalLabel: 'Total levantado', unit: 'kg' },
    volume: { label: 'Volume', chartTitle: 'Evolução de Volume (séries)', totalLabel: 'Total de séries', unit: '' },
    repeticoes: { label: 'Repetições', chartTitle: 'Evolução de Repetições', totalLabel: 'Total de repetições', unit: '' },
    prs: { label: 'PRs', chartTitle: 'Evolução de PRs', totalLabel: 'Recordes pessoais', unit: '' }
  };

  $: rawMuscleGroups = $allSessionSets && $catalog ? tonnageByMuscleGroup($allSessionSets, $catalog) : [];
  
  // Lista de grupos musculares disponíveis com base nos dados do usuário e constantes
  $: availableMuscleGroups = ['all', ...Array.from(new Set([
    ...MUSCLE_GROUPS,
    ...(rawMuscleGroups.map(m => m.group))
  ]))];

  // Filtra as séries pelo grupo muscular selecionado
  $: groupFilteredSets = filterSetsByMuscleGroup($allSessionSets, $catalog, selectedGroup);

  // PRs calculados a partir das séries filtradas do grupo
  $: prSets = groupFilteredSets ? computePRs(groupFilteredSets) : [];

  $: valueFn =
    metric === 'carga'
      ? totalTonnage
      : metric === 'volume'
        ? totalSetCount
        : metric === 'repeticoes'
          ? totalReps
          : (sets) => sets.length; // prs

  $: sourceSets = metric === 'prs' ? prSets : (groupFilteredSets ?? []);

  $: buckets = $allSessionSets ? buildPeriodBuckets(sourceSets, period) : [];
  $: chartSeries = buckets.length > 0 ? bucketSeries(sourceSets, buckets, valueFn) : { labels: [], data: [] };

  $: periodTotal = chartSeries.data.reduce((a, b) => a + b, 0);

  // Variação vs período anterior de mesmo tamanho
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

  // Comparação detalhada treino a treino para o grupo muscular selecionado
  $: muscleGroupComparison = selectedGroup !== 'all' && $allSessionSets && $catalog
    ? compareMuscleGroupSessions($allSessionSets, $catalog, selectedGroup)
    : null;

  $: muscleGroups = rawMuscleGroups;
  let showAllGroups = false;
  $: visibleGroups = showAllGroups ? muscleGroups : muscleGroups.slice(0, 5);
  $: topGroupKg = muscleGroups.length > 0 ? muscleGroups[0].kg : 0;

  function formatTotal(value, unit) {
    const rounded = Math.round(value * 10) / 10;
    return unit ? `${rounded.toLocaleString('pt-BR')}${unit}` : rounded.toLocaleString('pt-BR');
  }

  function selectGroup(grp) {
    selectedGroup = grp;
  }

  // ---------- Consistência ----------
  const sessions = liveQuery(() => db.workoutSessions.toArray());
  $: calendarColumns = $sessions ? weeklyCalendar($sessions, 9) : [];
  $: totalTrained = $sessions ? new Set($sessions.filter((s) => s.finishedAt && !s.isRestDay).map((s) => s.finishedAt.slice(0, 10))).size : 0;
  $: streak = $sessions ? currentStreak($sessions) : 0;
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">
  <button class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors" on:click={() => navigate('training')}>← Voltar para Treinos</button>
  <h1 class="text-2xl font-black text-white mb-4">Métricas</h1>

  <div class="flex bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-1 mb-6 text-xs shadow-inner relative">
    {#each [['perimetria', 'Perimetria'], ['desempenho', 'Desempenho'], ['consistencia', 'Consistência']] as [value, label]}
      <button
        class="flex-1 py-2 rounded-[12px] font-bold transition-all relative z-10 {tab === value ? 'bg-[#9333EA] text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-white/40 hover:text-white/70'}"
        on:click={() => (tab = value)}
      >
        {label}
      </button>
    {/each}
  </div>

  {#if tab === 'perimetria'}
    <section>
      {#if latestMeasurement}
        <div class="flex justify-between items-center mb-2">
          <p class="text-[10px] text-white/40 font-bold uppercase tracking-wider">Última medição: {formatDate(latestMeasurement.date)}</p>
          <div class="flex gap-2">
            <button class="text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded-[6px] border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors" on:click={editLatest}>
              Editar
            </button>
            <button class="text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded-[6px] border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500/20 transition-colors" on:click={deleteLatest}>
              Excluir
            </button>
          </div>
        </div>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 mb-5 shadow-inner flex flex-col gap-3">
          {#each summaryRows as row}
            <div class="flex justify-between items-center">
              <span class="text-white/70 text-[11px] font-bold">{row.label}</span>
              <div class="flex items-center gap-3">
                <span class="font-black text-[13px] text-white">{row.value != null ? `${row.value}${row.unit}` : '-'}</span>
                {#if row.delta != null && row.delta !== 0}
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-[6px] {row.delta < 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
                    {row.delta > 0 ? '+' : ''}{row.delta}{row.unit}
                  </span>
                {:else if row.delta === 0}
                  <span class="text-[10px] font-bold text-white/30 px-1.5 py-0.5">-</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-6 mb-5 text-center shadow-inner">
          <p class="text-xs text-white/40">Registre sua primeira medição abaixo para ver o resumo aqui.</p>
        </div>
      {/if}

      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 mb-6 shadow-inner">
        <p class="text-[12px] font-bold text-white mb-1">Evolução do peso</p>
        <p class="text-[9px] text-white/40 mb-4 uppercase tracking-wider">Últimos 30 dias</p>
        {#if weightTrend30d.labels.length >= 2}
          <LineChart labels={weightTrend30d.labels} data={weightTrend30d.data} label="Peso (kg)" />
        {:else}
          <p class="text-[10px] text-white/40 text-center py-4">Registre pelo menos duas medições de peso pra ver a evolução aqui.</p>
        {/if}
      </div>

      <!-- Calculadora de Calorias -->
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 mb-6 shadow-inner relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div class="flex justify-between items-center mb-3 relative z-10">
          <p class="text-[13px] font-bold text-white">Cálculo de Calorias Diárias</p>
          <span class="text-xl filter drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]">🔥</span>
        </div>
        
        <p class="text-[9px] text-white/50 mb-5 leading-relaxed relative z-10">
          Baseado na sua idade, peso e altura (altere no formulário abaixo). Ajuste para seu perfil e objetivo.
        </p>

        <div class="flex flex-col gap-3 mb-5 relative z-10">
          <div class="flex gap-2">
            <button class="flex-1 py-2 text-[10px] font-bold rounded-[10px] border transition-all {calcGender === 'M' ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}" on:click={() => calcGender = 'M'}>Masculino</button>
            <button class="flex-1 py-2 text-[10px] font-bold rounded-[10px] border transition-all {calcGender === 'F' ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}" on:click={() => calcGender = 'F'}>Feminino</button>
          </div>
          
          <select class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#a855f7] transition-colors" bind:value={calcActivity}>
            <option value={1.2}>Sedentário (pouco/nenhum exercício)</option>
            <option value={1.375}>Levemente ativo (exercício leve 1-3 dias)</option>
            <option value={1.55}>Moderadamente ativo (esporte 3-5 dias)</option>
            <option value={1.725}>Muito ativo (exercício intenso 6-7 dias)</option>
          </select>
          
          <div class="flex gap-2">
            <button class="flex-1 py-2 text-[10px] font-bold rounded-[10px] border transition-all {calcGoal === 'lose' ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}" on:click={() => calcGoal = 'lose'}>Perder</button>
            <button class="flex-1 py-2 text-[10px] font-bold rounded-[10px] border transition-all {calcGoal === 'maintain' ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}" on:click={() => calcGoal = 'maintain'}>Manter</button>
            <button class="flex-1 py-2 text-[10px] font-bold rounded-[10px] border transition-all {calcGoal === 'gain' ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}" on:click={() => calcGoal = 'gain'}>Ganhar</button>
          </div>
        </div>

        {#if targetCalories}
          <div class="flex items-center justify-between bg-white/5 rounded-[12px] p-4 border border-[#a855f7]/30 relative z-10 shadow-inner">
            <span class="text-[11px] font-bold text-white/80">Sua meta diária:</span>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-orange-400 tracking-tight drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]">{targetCalories}</span>
              <span class="text-[9px] text-white/40 uppercase font-bold tracking-wider">kcal</span>
            </div>
          </div>
        {:else}
          <div class="text-[10px] text-white/40 text-center bg-white/5 rounded-[12px] p-4 border border-white/5 relative z-10">
            Preencha idade, peso e altura no formulário abaixo para gerar o cálculo.
          </div>
        {/if}
      </div>

      <h2 id="perimetria-form-heading" class="text-[11px] uppercase text-white/40 mb-3 font-bold tracking-wider flex items-center gap-2 mt-8">
         <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
         {editingId ? 'Editar perimetria' : 'Cadastrar nova perimetria'}
      </h2>
      <form on:submit|preventDefault={saveMeasurement} class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 flex flex-col gap-4 shadow-inner">
        <div class="flex justify-between items-center">
          <input type="date" class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] custom-date flex-1" bind:value={date} />
          {#if editingId}
            <button type="button" class="ml-2 text-[10px] font-bold text-red-400 uppercase hover:text-white" on:click={() => { editingId = null; age = weight = height = shoulder = chest = abdomen = thigh = calf = armLeft = armRight = forearm = bodyFatPercent = ''; date = new Date().toISOString().slice(0, 10); }}>
              Cancelar
            </button>
          {/if}
        </div>

        <div>
          <p class="text-[9px] text-[#a855f7] font-bold uppercase tracking-wider mb-2">Perfil</p>
          <div class="grid grid-cols-3 gap-2">
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Idade" type="number" bind:value={age} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Peso (kg)" type="number" bind:value={weight} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Altura (cm)" type="number" bind:value={height} />
          </div>
        </div>

        <div>
          <p class="text-[9px] text-[#a855f7] font-bold uppercase tracking-wider mb-2">Circunferências (cm) e % Gordura</p>
          <div class="grid grid-cols-2 gap-2">
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Cintura" type="number" bind:value={abdomen} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Peitoral" type="number" bind:value={chest} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Ombro" type="number" bind:value={shoulder} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Coxa" type="number" bind:value={thigh} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Panturrilha" type="number" bind:value={calf} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Antebraço" type="number" bind:value={forearm} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Braço esquerdo" type="number" bind:value={armLeft} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="Braço direito" type="number" bind:value={armRight} />
            <input class="bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[11px] text-white outline-none focus:border-[#a855f7] placeholder:text-white/30" placeholder="% Gordura" type="number" bind:value={bodyFatPercent} />
          </div>
        </div>

        <button type="submit" class="bg-[#9333EA] text-white rounded-[12px] py-3 font-bold text-[11px] shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:bg-[#a855f7] transition-colors mt-2">
          {editingId ? 'Salvar Alterações' : 'Registrar medição'}
        </button>
      </form>
    </section>
  {:else if tab === 'desempenho'}
    <section>
      <!-- Seletor de Grupos Musculares com Rolagem Horizontal Suave -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2 px-0.5">
          <p class="text-[10px] text-white/50 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span>Grupo Muscular:</span>
            <span class="text-[#c084fc] font-black">
              {selectedGroup === 'all' ? 'Todos os grupos' : selectedGroup}
            </span>
          </p>
          {#if selectedGroup !== 'all'}
            <button
              class="text-[9px] font-bold text-[#c084fc] hover:text-white uppercase tracking-wider transition-colors"
              on:click={() => (selectedGroup = 'all')}
            >
              Resetar para Todos
            </button>
          {/if}
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
          {#each availableMuscleGroups as grp}
            {@const isSelected = selectedGroup === grp}
            <button
              class="px-3 py-2 rounded-[12px] text-[11px] font-bold shrink-0 flex items-center gap-1.5 transition-all border {isSelected ? 'bg-gradient-to-r from-[#9333EA] to-[#7e22ce] text-white border-[#a855f7]/60 shadow-[0_0_15px_rgba(147,51,234,0.4)] scale-[1.02]' : 'bg-[#1C1C22]/80 border-white/5 text-white/50 hover:text-white hover:bg-white/5'}"
              on:click={() => selectGroup(grp)}
            >
              <span class="text-sm">{getGroupIcon(grp)}</span>
              <span>{grp === 'all' ? 'Todos' : grp}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Card Especial de Comparativo Direto: Último Treino vs Anterior (Exibido quando um grupo está selecionado) -->
      {#if selectedGroup !== 'all'}
        <div class="bg-gradient-to-br from-[#1C1C22] to-[#15151c] border border-white/10 rounded-[20px] p-5 mb-5 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-12 -right-12 w-32 h-32 bg-[#9333EA]/15 rounded-full blur-2xl pointer-events-none"></div>

          <div class="flex justify-between items-start mb-4 relative z-10">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl">{getGroupIcon(selectedGroup)}</span>
                <h3 class="text-[14px] font-black text-white">{selectedGroup}</h3>
              </div>
              <p class="text-[10px] text-white/50 mt-0.5">
                {#if muscleGroupComparison?.previous}
                  Último: {formatDate(muscleGroupComparison.latest.date)} vs {formatDate(muscleGroupComparison.previous.date)}
                  {#if muscleGroupComparison.daysApart != null}
                    <span class="text-white/30">({muscleGroupComparison.daysApart}d de intervalo)</span>
                  {/if}
                {:else if muscleGroupComparison?.latest}
                  Primeiro treino em {formatDate(muscleGroupComparison.latest.date)}
                {:else}
                  Nenhum treino registrado ainda
                {/if}
              </p>
            </div>

            {#if muscleGroupComparison?.latest}
              <span class="text-[9px] uppercase font-bold px-2 py-1 rounded-[6px] border {muscleGroupComparison.badgeType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : muscleGroupComparison.badgeType === 'warning' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-purple-500/10 text-purple-300 border-purple-500/30'}">
                {muscleGroupComparison.badgeType === 'success' ? 'Progressão' : muscleGroupComparison.badgeType === 'warning' ? 'Ajuste / Deload' : 'Consistência'}
              </span>
            {/if}
          </div>

          {#if muscleGroupComparison?.latest}
            <!-- Grid de 3 Métricas Comparativas -->
            <div class="grid grid-cols-3 gap-2.5 mb-4 relative z-10">
              <!-- Carga Máxima -->
              <div class="bg-white/5 border border-white/5 rounded-[14px] p-3 flex flex-col justify-between">
                <p class="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Carga Máx</p>
                <div>
                  <p class="text-[15px] font-black text-white leading-tight">
                    {muscleGroupComparison.latest.maxWeight} <span class="text-[10px] font-bold text-white/50">kg</span>
                  </p>
                  {#if muscleGroupComparison.previous}
                    <p class="text-[9px] font-bold mt-1 {muscleGroupComparison.deltaMaxWeight > 0 ? 'text-green-400' : muscleGroupComparison.deltaMaxWeight < 0 ? 'text-amber-400' : 'text-white/40'}">
                      {muscleGroupComparison.deltaMaxWeight > 0 ? `+${muscleGroupComparison.deltaMaxWeight}kg` : muscleGroupComparison.deltaMaxWeight < 0 ? `${muscleGroupComparison.deltaMaxWeight}kg` : 'Mantida'}
                    </p>
                  {:else}
                    <p class="text-[9px] text-white/30 mt-1">Base</p>
                  {/if}
                </div>
              </div>

              <!-- Volume de Séries -->
              <div class="bg-white/5 border border-white/5 rounded-[14px] p-3 flex flex-col justify-between">
                <p class="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Volume</p>
                <div>
                  <p class="text-[15px] font-black text-white leading-tight">
                    {muscleGroupComparison.latest.setsCount} <span class="text-[10px] font-bold text-white/50">séries</span>
                  </p>
                  {#if muscleGroupComparison.previous}
                    <p class="text-[9px] font-bold mt-1 {muscleGroupComparison.deltaSets > 0 ? 'text-green-400' : muscleGroupComparison.deltaSets < 0 ? 'text-amber-400' : 'text-white/40'}">
                      {muscleGroupComparison.deltaSets > 0 ? `+${muscleGroupComparison.deltaSets} s.` : muscleGroupComparison.deltaSets < 0 ? `${muscleGroupComparison.deltaSets} s.` : 'Mesmo'}
                    </p>
                  {:else}
                    <p class="text-[9px] text-white/30 mt-1">Base</p>
                  {/if}
                </div>
              </div>

              <!-- Tonelagem Total -->
              <div class="bg-white/5 border border-white/5 rounded-[14px] p-3 flex flex-col justify-between">
                <p class="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1">Tonelagem</p>
                <div>
                  <p class="text-[15px] font-black text-white leading-tight truncate">
                    {(muscleGroupComparison.latest.totalTonnage / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span class="text-[10px] font-bold text-white/50">t</span>
                  </p>
                  {#if muscleGroupComparison.previous && muscleGroupComparison.deltaTonnagePercent != null}
                    <p class="text-[9px] font-bold mt-1 {muscleGroupComparison.deltaTonnagePercent > 0 ? 'text-green-400' : muscleGroupComparison.deltaTonnagePercent < 0 ? 'text-amber-400' : 'text-white/40'}">
                      {muscleGroupComparison.deltaTonnagePercent > 0 ? '+' : ''}{muscleGroupComparison.deltaTonnagePercent}%
                    </p>
                  {:else}
                    <p class="text-[9px] text-white/30 mt-1">Base</p>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Caixa de Feedback e Diagnóstico Inteligente de Esforço -->
            <div class="bg-white/[0.03] border border-white/5 rounded-[14px] p-3 text-[10px] text-white/70 leading-relaxed mb-3 relative z-10 flex items-start gap-2.5">
              <span>{muscleGroupComparison.badgeType === 'success' ? '🎯' : muscleGroupComparison.badgeType === 'warning' ? '⚡' : '📌'}</span>
              <p class="flex-1">{muscleGroupComparison.feedback}</p>
            </div>

            <!-- Exercícios Realizados no Último Treino -->
            {#if muscleGroupComparison.latest.exercises && muscleGroupComparison.latest.exercises.length > 0}
              <div class="pt-3 border-t border-white/5 relative z-10">
                <p class="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-2">Exercícios executados na sessão:</p>
                <div class="flex flex-wrap gap-1.5">
                  {#each muscleGroupComparison.latest.exercises as ex}
                    <div class="bg-white/5 border border-white/5 rounded-[8px] px-2.5 py-1 text-[10px] flex items-center gap-1.5">
                      <span class="text-white font-medium">{ex.name}</span>
                      <span class="text-[#c084fc] font-bold">{ex.maxWeight} kg</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {:else}
            <p class="text-[10px] text-white/40 text-center py-4">
              Ainda não há treinos registrados com exercícios de {selectedGroup}. Conclua um treino para ver a evolução comparativa aqui!
            </p>
          {/if}
        </div>
      {/if}

      <!-- Seletores de Métrica (Carga, Volume, Repetições, PRs) -->
      <div class="flex bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-1 mb-2 text-[10px] font-bold shadow-inner gap-1">
        {#each Object.entries(METRIC_CONFIG) as [value, config]}
          <button
            class="flex-1 py-2 rounded-[12px] transition-all {metric === value ? 'bg-[#9333EA] text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'text-white/40 hover:text-white/70'}"
            on:click={() => (metric = value)}
          >
            {config.label}
          </button>
        {/each}
      </div>

      <!-- Filtro de Período (7d, 30d, 60d, Tudo) -->
      <div class="flex bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-1 mb-5 text-[10px] font-bold shadow-inner gap-1">
        {#each [[7, '7 dias'], [30, '30 dias'], [60, '60 dias'], [null, 'Tudo']] as [value, label]}
          <button
            class="flex-1 py-2 rounded-[12px] transition-all {period === value ? 'bg-white/10 text-white border border-white/10' : 'text-white/40 hover:text-white/70'}"
            on:click={() => (period = value)}
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Gráfico de Evolução (LineChart) -->
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 mb-5 shadow-inner">
        <div class="flex justify-between items-start mb-4">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-sm">{getGroupIcon(selectedGroup)}</span>
              <p class="text-[12px] font-bold text-white mb-0.5">
                {selectedGroup === 'all' ? METRIC_CONFIG[metric].chartTitle : `Evolução de ${METRIC_CONFIG[metric].label} · ${selectedGroup}`}
              </p>
            </div>
            <p class="text-[9px] font-bold text-[#a855f7] uppercase tracking-wider">{METRIC_CONFIG[metric].totalLabel}</p>
          </div>
          <div class="text-right">
            <p class="font-black text-[15px] text-white">{formatTotal(periodTotal, METRIC_CONFIG[metric].unit)}</p>
            {#if deltaPercent != null}
              <p class="text-[9px] font-bold {deltaPercent >= 0 ? 'text-green-400' : 'text-red-400'}">
                {deltaPercent > 0 ? '+' : ''}{deltaPercent}% vs ant.
              </p>
            {/if}
          </div>
        </div>

        {#if chartSeries.labels.length === 0 || periodTotal === 0}
          <p class="text-[10px] text-white/40 text-center py-6 px-4 bg-white/5 rounded-[12px] border border-white/5">
            Sem dados de {METRIC_CONFIG[metric].label.toLowerCase()}{selectedGroup !== 'all' ? ` para ${selectedGroup}` : ''} nesse período.
          </p>
        {:else}
          <LineChart
            labels={chartSeries.labels}
            data={chartSeries.data}
            label={selectedGroup === 'all' ? METRIC_CONFIG[metric].label : `${METRIC_CONFIG[metric].label} (${selectedGroup})`}
          />
        {/if}
      </div>

      <!-- Comparativo e Distribuição de Todos os Grupos Musculares -->
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
        <div class="flex justify-between items-center mb-4">
          <div>
            <p class="text-[12px] font-bold text-white">Distribuição Muscular</p>
            <p class="text-[9px] text-white/40">Toque em qualquer grupo para detalhar a evolução</p>
          </div>
          {#if selectedGroup !== 'all'}
            <button
              class="text-[10px] font-bold text-[#a855f7] hover:text-white transition-colors"
              on:click={() => (selectedGroup = 'all')}
            >
              Resetar filtro
            </button>
          {/if}
        </div>

        {#if muscleGroups.length === 0}
          <p class="text-[10px] text-white/40 text-center py-4">Cadastre exercícios com grupo muscular para ver essa distribuição.</p>
        {:else}
          <div class="flex flex-col gap-3">
            {#each visibleGroups as g (g.group)}
              {@const isCurrent = selectedGroup === g.group}
              <button
                type="button"
                class="w-full text-left p-2.5 rounded-[14px] border transition-all {isCurrent ? 'bg-[#9333EA]/15 border-[#9333EA]/50 shadow-[0_0_12px_rgba(147,51,234,0.25)]' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}"
                on:click={() => selectGroup(g.group)}
              >
                <div class="flex justify-between text-[11px] font-bold mb-1.5 items-center">
                  <span class="flex items-center gap-1.5 {isCurrent ? 'text-white' : 'text-white/80'}">
                    <span>{getGroupIcon(g.group)}</span>
                    <span>{g.group}</span>
                    {#if isCurrent}
                      <span class="text-[8px] bg-[#9333EA] text-white px-1.5 py-0.5 rounded font-black uppercase">Ativo</span>
                    {/if}
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="text-[#c084fc]">{(g.kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton</span>
                    <span class="text-white/30 text-xs">→</span>
                  </div>
                </div>
                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    class="h-full bg-gradient-to-r from-[#9333EA] to-[#c084fc] rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                    style="width: {topGroupKg > 0 ? Math.max(4, (g.kg / topGroupKg) * 100) : 0}%"
                  />
                </div>
              </button>
            {/each}
          </div>

          {#if muscleGroups.length > 5}
            <button
              class="w-full text-[10px] font-bold text-[#a855f7] mt-4 pt-3 border-t border-white/5 hover:text-white transition-colors uppercase tracking-wider"
              on:click={() => (showAllGroups = !showAllGroups)}
            >
              {showAllGroups ? 'Ver menos' : 'Ver todos os grupos'}
            </button>
          {/if}
        {/if}
      </div>
    </section>
  {:else}
    <section>
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
        {#if $sessions && $sessions.length === 0}
          <p class="text-[10px] text-white/40 text-center py-6">
            Nenhuma sessão de treino concluída ainda — esse calendário marca em quais dias você treinou.
          </p>
        {:else}
          <ConsistencyCalendar columns={calendarColumns} {totalTrained} {streak} />
        {/if}
      </div>
    </section>
  {/if}
</main>
<style>
  .custom-date::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.5;
    cursor: pointer;
  }
</style>
