<script>
  import { db } from '../db/db.js';
  import { generateId } from '../lib/id.js';
  import { navigate } from '../lib/nav.js';
  import { WEEKDAYS, EQUIPMENT_TYPES } from '../lib/constants.js';
  import { enqueue, pushSync } from '../services/syncService.js';
  import { api } from '../lib/api.js';
  import { addExerciseToPlan } from '../services/workoutService.js';

  // ── Controle de modo ─────────────────────────────────────────────────────────
  // null = tela de seleção | 'scan' | 'ai' | 'manual'
  let mode = null;

  let name = '';
  let weekdays = [];

  // ── Estado: IA de texto ──────────────────────────────────────────────────────
  let isLoadingAI = false;
  let aiGoal = '';
  let aiLevel = 'intermediario';
  let aiDuration = 60;
  let aiEquipment = [];
  let aiResult = null;
  let aiError = null;

  // ── Estado: Scan por Foto ────────────────────────────────────────────────────
  let isScanningSheet = false;
  let scanResult = null;
  let scanError = null;
  let scanPreviewUrls = [];

  const activeDays = WEEKDAYS.filter(w => w.value !== null);

  function selectMode(m) {
    mode = m;
    aiResult = null; aiError = null;
    scanResult = null; scanError = null; scanPreviewUrls = [];
    name = '';
    weekdays = [];
  }

  function toggleDay(val) {
    weekdays = weekdays.includes(val)
      ? weekdays.filter(d => d !== val)
      : [...weekdays, val];
  }

  function toggleEquipment(val) {
    aiEquipment = aiEquipment.includes(val)
      ? aiEquipment.filter(e => e !== val)
      : [...aiEquipment, val];
  }

  async function handleScanSheet(event, isAddingMore = false) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        scanError = 'Cada arquivo deve ter no máximo 20 MB.';
        return;
      }
    }

    isScanningSheet = true;
    scanError = null;

    if (!isAddingMore) {
      scanResult = null;
      scanPreviewUrls = [];
    }

    const newPreviews = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => URL.createObjectURL(f));
    scanPreviewUrls = [...scanPreviewUrls, ...newPreviews];

    try {
      const imagesData = await Promise.all(
        files.map(async (file) => {
          // Se for PDF, lê direto como base64
          if (file.type === 'application/pdf') {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            return { image_base64: base64, mime_type: 'application/pdf' };
          }

          // Para imagens de celular (que costumam ter 4000x3000 e 8-15 MB):
          // Redimensiona no navegador para no máximo 1280px e comprime JPEG a 80%.
          // Isso reduz de 10 MB para ~250 KB sem perder nenhuma nitidez no texto,
          // fazendo o upload ser 20x mais rápido no celular!
          const compressedBase64 = await new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              URL.revokeObjectURL(url);
              // 1800px preserva perfeita legibilidade de caneta e traços finos
              // enquanto reduz uma foto de 12 MB para cerca de 500 KB (ideal para OCR rápido e preciso)
              const maxDim = 1800;
              let width = img.width;
              let height = img.height;

              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

              // 90% de qualidade mantém traços de caneta azuis/pretos sem artefatos de compressão
              const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
              resolve(dataUrl);
            };
            img.onerror = async () => {
              // Fallback para leitura bruta se falhar canvas
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(file);
            };
            img.src = url;
          });

          return {
            image_base64: compressedBase64,
            mime_type: 'image/jpeg',
          };
        })
      );

      const result = await api.scanWorkoutSheet(imagesData);

      if (isAddingMore && scanResult) {
        // Mesclar de forma inteligente com os treinos existentes
        const existingWorkouts = scanResult.workouts || [];
        const newWorkouts = result.workouts || [];

        const mergedMap = new Map();
        for (const w of existingWorkouts) {
          mergedMap.set(w.name.toLowerCase().trim(), { ...w, exercises: [...w.exercises] });
        }

        for (const nw of newWorkouts) {
          const key = nw.name.toLowerCase().trim();
          if (mergedMap.has(key)) {
            // Adicionar exercícios evitando duplicatas exatas
            const target = mergedMap.get(key);
            for (const nex of nw.exercises) {
              if (!target.exercises.some(e => e.name.toLowerCase().trim() === nex.name.toLowerCase().trim())) {
                target.exercises.push(nex);
              }
            }
          } else {
            mergedMap.set(key, { ...nw, exercises: [...nw.exercises] });
          }
        }

        const mergedList = Array.from(mergedMap.values());
        const mergedExercises = mergedList.flatMap(w => w.exercises);

        scanResult = {
          plan_name_suggestion: scanResult.plan_name_suggestion || result.plan_name_suggestion,
          workouts: mergedList,
          exercises: mergedExercises,
        };
      } else {
        scanResult = result;
        if (result.plan_name_suggestion && !name) name = result.plan_name_suggestion;
      }
    } catch (e) {
      console.error('[Scan] Erro ao analisar ficha:', e);
      scanError = 'Não foi possível analisar as fotos. Verifique sua conexão e tente novamente.';
    } finally {
      isScanningSheet = false;
      event.target.value = '';
    }
  }

  async function handleGenerateAI() {
    if (!aiGoal.trim() || isLoadingAI) return;
    isLoadingAI = true;
    aiError = null;
    aiResult = null;
    try {
      const result = await api.generateWorkoutPlan({
        goal: aiGoal.trim(),
        equipment: aiEquipment,
        level: aiLevel,
        days_per_week: weekdays.length > 0 ? weekdays.length : 3,
        session_duration_min: aiDuration,
      });
      aiResult = result;
      name = result.plan_name;
    } catch (e) {
      console.error('[IA] Erro ao gerar plano:', e);
      aiError = 'Não foi possível gerar a ficha. Verifique sua conexão e tente novamente.';
    } finally {
      isLoadingAI = false;
    }
  }

  async function saveSingleWorkout(workout) {
    if (!workout || !workout.exercises?.length) return;

    const plan = {
      id: generateId(),
      name: workout.name.trim() || 'Novo Treino',
      weekday: JSON.stringify(weekdays),
    };
    await db.workoutPlans.put(plan);
    await enqueue('upsert', 'workoutPlans', plan.id, plan);

    const catalog = await db.exercises.toArray();
    for (const ex of workout.exercises) {
      await addExerciseToPlan({
        planId: plan.id,
        catalog,
        exerciseName: ex.name,
        muscleGroup: ex.muscle_group,
        equipment: ex.equipment ?? 'Livre',
        targetSets: ex.sets,
        targetReps: ex.reps ?? 'Livre',
        restSeconds: ex.rest_seconds,
      });
    }

    pushSync().catch(() => {});
    navigate('workout-plan-detail', {
      planId: plan.id,
      isEditing: false,
      isNew: false,
    });
  }

  async function saveAllWorkouts() {
    if (!scanResult?.workouts?.length) {
      await createPlan(false);
      return;
    }

    const catalog = await db.exercises.toArray();
    let firstPlanId = null;

    for (const w of scanResult.workouts) {
      const plan = {
        id: generateId(),
        name: w.name.trim() || 'Novo Treino',
        weekday: JSON.stringify(weekdays),
      };
      await db.workoutPlans.put(plan);
      await enqueue('upsert', 'workoutPlans', plan.id, plan);
      if (!firstPlanId) firstPlanId = plan.id;

      for (const ex of w.exercises) {
        await addExerciseToPlan({
          planId: plan.id,
          catalog,
          exerciseName: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment ?? 'Livre',
          targetSets: ex.sets,
          targetReps: ex.reps ?? 'Livre',
          restSeconds: ex.rest_seconds,
        });
      }
    }

    pushSync().catch(() => {});
    navigate('training');
  }

  async function createPlan(goToEdit = false) {
    if (!name.trim()) return;

    const plan = {
      id: generateId(),
      name: name.trim(),
      weekday: JSON.stringify(weekdays),
    };
    await db.workoutPlans.put(plan);
    await enqueue('upsert', 'workoutPlans', plan.id, plan);

    const exercisesToSave = scanResult?.exercises ?? aiResult?.exercises;

    if (exercisesToSave?.length) {
      const catalog = await db.exercises.toArray();
      for (const ex of exercisesToSave) {
        await addExerciseToPlan({
          planId: plan.id,
          catalog,
          exerciseName: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment ?? 'Livre',
          targetSets: ex.sets,
          targetReps: ex.reps ?? 'Livre',
          restSeconds: ex.rest_seconds,
        });
      }
    }

    pushSync().catch(() => {});
    navigate('workout-plan-detail', {
      planId: plan.id,
      isEditing: goToEdit === true,
      isNew: !scanResult && !aiResult,
    });
  }
</script>

<main class="min-h-screen p-4 pb-24 max-w-md mx-auto">

  <!-- Cabeçalho -->
  <button
    class="text-[10px] text-[#a855f7] mb-4 flex items-center gap-1 font-bold uppercase tracking-wider hover:text-white transition-colors"
    on:click={() => mode ? selectMode(null) : navigate('training')}
  >
    {`← ${mode ? 'Escolher outro modo' : 'Voltar para Treinos'}`}
  </button>

  <h1 class="text-2xl font-black text-white mb-1">Novo treino</h1>
  <p class="text-[11px] text-white/40 mb-6">
    {mode === null ? 'Como você quer criar sua ficha?' : mode === 'scan' ? '📸 Importar ficha por foto' : mode === 'ai' ? '🤖 Gerar ficha com IA' : '✏️ Criar manualmente'}
  </p>

  <!-- TELA DE SELEÇÃO -->
  {#if mode === null}
    <div class="flex flex-col gap-3">

      <button
        class="w-full text-left bg-[#0f172a] border border-blue-500/30 rounded-[20px] p-5 flex items-center gap-4 hover:border-blue-400/60 hover:bg-blue-500/5 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('scan')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-blue-500/15 group-hover:bg-blue-500/25 transition-colors">
          <svg class="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Importar ficha por foto</p>
          <p class="text-[10px] text-white/50 mt-1">Fotografe a ficha do seu personal e a IA lê os exercícios automaticamente</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button
        class="w-full text-left bg-[#0f172a] border border-purple-500/30 rounded-[20px] p-5 flex items-center gap-4 hover:border-purple-400/60 hover:bg-purple-500/5 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('ai')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-purple-500/15 group-hover:bg-purple-500/25 transition-colors">
          <svg class="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.16-5.18"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Gerar ficha com IA</p>
          <p class="text-[10px] text-white/50 mt-1">Descreva seu objetivo e a IA monta a ficha completa com exercícios</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button
        class="w-full text-left bg-[#0f172a] border border-white/10 rounded-[20px] p-5 flex items-center gap-4 hover:border-white/25 hover:bg-white/3 transition-all group active:scale-[0.98]"
        on:click={() => selectMode('manual')}
      >
        <div class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 bg-white/5 group-hover:bg-white/10 transition-colors">
          <svg class="w-6 h-6 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-black text-white leading-tight">Criar manualmente</p>
          <p class="text-[10px] text-white/50 mt-1">Dê um nome e adicione os exercícios um a um</p>
        </div>
        <svg class="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

  <!-- MODO: SCAN POR FOTO -->
  {:else if mode === 'scan'}

    {#if scanResult}
      <div class="flex flex-col gap-4">
        <!-- Previews das páginas analisadas -->
        {#if scanPreviewUrls.length > 0}
          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {#each scanPreviewUrls as pUrl, idx}
              <div class="relative shrink-0 w-24 h-24 rounded-[12px] overflow-hidden border border-white/10">
                <img src={pUrl} alt="Página {idx + 1}" class="w-full h-full object-cover" />
                <span class="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-[4px]">
                  Pág {idx + 1}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        {#if scanResult.workouts && scanResult.workouts.length > 0}
          <div class="flex items-center justify-between">
            <p class="text-[11px] text-blue-400 font-bold uppercase tracking-wider">
              📋 {scanResult.workouts.length} {scanResult.workouts.length === 1 ? 'treino identificado' : 'divisões de treino identificadas'}
            </p>
            {#if scanResult.workouts.length > 1}
              <button
                class="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-[10px] hover:bg-blue-500/30 transition-colors"
                on:click={saveAllWorkouts}
              >
                Salvar todos juntos ({scanResult.workouts.length})
              </button>
            {/if}
          </div>

          <div class="flex flex-col gap-3">
            {#each scanResult.workouts as workout, wIdx}
              <div class="bg-[#1C1C22]/80 border border-blue-500/20 rounded-[18px] p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div>
                    <h3 class="text-[13px] font-black text-white">{workout.name}</h3>
                    <p class="text-[10px] text-white/40">{workout.exercises.length} exercícios</p>
                  </div>
                  <button
                    class="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3 py-1.5 rounded-[10px] transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                    on:click={() => saveSingleWorkout(workout)}
                  >
                    <span>Salvar este treino</span>
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </button>
                </div>

                <div class="flex flex-col gap-1.5">
                  {#each workout.exercises as ex, i}
                    <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2">
                      <span class="text-[10px] text-white/30 font-bold w-4 shrink-0">{i + 1}</span>
                      <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                        <p class="text-[9px] text-blue-400 font-medium capitalize">{ex.muscle_group}</p>
                      </div>
                      <span class="text-[9px] text-white/50 font-bold bg-white/5 px-2 py-1 rounded-[6px] shrink-0">{ex.sets}x{ex.reps}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

        {:else}
          <!-- Formato de treino único -->
          <div class="bg-blue-500/10 border border-blue-500/20 rounded-[20px] p-4">
            <p class="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-2">📷 {scanResult.exercises.length} exercícios detectados</p>
            <div class="flex flex-col gap-2">
              {#each scanResult.exercises as ex, i}
                <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2.5">
                  <span class="text-[10px] text-white/30 font-bold w-5 shrink-0">{i + 1}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                    <p class="text-[9px] text-blue-400 font-medium capitalize">{ex.muscle_group}</p>
                  </div>
                  <span class="text-[9px] text-white/40 font-bold shrink-0">{ex.sets}x{ex.reps}</span>
                </div>
              {/each}
            </div>
          </div>

          <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
            <label class="text-[10px] text-blue-400 mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
            <input
              class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-2.5 text-[12px] font-bold text-white focus:border-blue-400 outline-none placeholder:text-white/30 transition-colors"
              placeholder="ex: Treino A — Peito e Costas"
              bind:value={name}
            />
          </div>

          <button
            class="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[16px] py-4 text-[12px] font-black shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
            on:click={() => createPlan(false)}
            disabled={!name.trim()}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            SALVAR FICHA
          </button>
        {/if}

        <!-- Botão para adicionar mais uma página de forma cumulativa -->
        <div class="flex items-center gap-2 pt-2 border-t border-white/10">
          <label class="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-[14px] py-3 px-4 transition-all flex items-center justify-center gap-2 text-[11px] font-bold">
            <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            <span>+ Adicionar outra página / verso</span>
            <input type="file" accept="image/*,application/pdf" multiple class="hidden" on:change={(e) => handleScanSheet(e, true)} />
          </label>
          <button class="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider py-3 px-3" on:click={() => { scanResult = null; scanPreviewUrls = []; }}>
            Recomeçar
          </button>
        </div>
      </div>

    {:else}
      <div class="flex flex-col gap-3">

        <!-- Loading com preview da imagem -->
        {#if isScanningSheet}
          <div class="bg-[#1C1C22]/80 border border-blue-500/20 rounded-[16px] p-5 flex flex-col items-center gap-3">
            {#if scanPreviewUrls.length > 0}
              <div class="relative w-full rounded-[12px] overflow-hidden">
                <img src={scanPreviewUrls[scanPreviewUrls.length - 1]} alt="Processando..." class="w-full max-h-44 object-cover opacity-40" />
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div class="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <p class="text-[11px] font-bold text-blue-300">Analisando {scanPreviewUrls.length} {scanPreviewUrls.length === 1 ? 'página' : 'páginas'} com IA...</p>
                </div>
              </div>
            {:else}
              <div class="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-[12px] font-bold text-blue-300">Lendo arquivos com IA...</p>
              <p class="text-[10px] text-white/40">Isso pode levar alguns segundos</p>
            {/if}
          </div>
        {/if}

        {#if scanError}
          <p class="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3">{scanError}</p>
        {/if}

        <!-- Opções de importação -->
        {#if !isScanningSheet}
          <div class="flex flex-col gap-2">
            <!-- Câmera -->
            <label class="w-full cursor-pointer bg-[#1C1C22]/80 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-400/50 text-white rounded-[16px] px-4 py-4 transition-all flex items-center gap-4 group">
              <div class="w-10 h-10 rounded-[12px] bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/25 transition-colors">
                <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <div class="flex-1">
                <p class="text-[13px] font-bold text-white">Tirar foto</p>
                <p class="text-[9px] text-white/40">Abrir câmera e fotografar a ficha</p>
              </div>
              <svg class="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              <input type="file" accept="image/*" capture="environment" class="hidden" on:change={handleScanSheet} />
            </label>

            <!-- Galeria com seleção múltipla -->
            <label class="w-full cursor-pointer bg-[#1C1C22]/80 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-400/50 text-white rounded-[16px] px-4 py-4 transition-all flex items-center gap-4 group">
              <div class="w-10 h-10 rounded-[12px] bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/25 transition-colors">
                <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <div class="flex-1">
                <p class="text-[13px] font-bold text-white">Escolher da galeria</p>
                <p class="text-[9px] text-white/40">Selecione uma ou mais fotos da ficha de uma vez</p>
              </div>
              <svg class="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              <input type="file" accept="image/*" multiple class="hidden" on:change={handleScanSheet} />
            </label>

            <!-- PDF -->
            <label class="w-full cursor-pointer bg-[#1C1C22]/80 hover:bg-orange-500/10 border border-orange-500/20 hover:border-orange-400/50 text-white rounded-[16px] px-4 py-4 transition-all flex items-center gap-4 group">
              <div class="w-10 h-10 rounded-[12px] bg-orange-500/15 flex items-center justify-center shrink-0 group-hover:bg-orange-500/25 transition-colors">
                <svg class="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div class="flex-1">
                <p class="text-[13px] font-bold text-white">Importar PDF</p>
                <p class="text-[9px] text-white/40">Ficha completa de várias páginas em PDF</p>
              </div>
              <svg class="w-4 h-4 text-white/20 group-hover:text-orange-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              <input type="file" accept="application/pdf" multiple class="hidden" on:change={handleScanSheet} />
            </label>
          </div>
          <p class="text-[9px] text-white/25 text-center">A IA lê fichas de várias páginas, frente e verso · Máx 20 MB por arquivo</p>
        {/if}

      </div>
    {/if}

  <!-- MODO: GERAR COM IA -->
  {:else if mode === 'ai'}

    {#if aiResult}
      <div class="flex flex-col gap-3">
        <div class="bg-green-500/10 border border-green-500/20 rounded-[20px] p-4">
          <p class="text-[10px] text-green-400 uppercase font-bold tracking-wider mb-1">✅ Ficha gerada pela IA</p>
          <p class="text-[13px] font-black text-white mb-1">{aiResult.plan_name}</p>
          <p class="text-[10px] text-white/40 leading-relaxed mb-3">{aiResult.rationale}</p>
          <div class="flex flex-col gap-2">
            {#each aiResult.exercises as ex}
              <div class="flex items-center gap-3 bg-white/5 rounded-[10px] px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold text-white truncate">{ex.name}</p>
                  <p class="text-[9px] text-purple-400 font-medium">{ex.muscle_group} · {ex.equipment}</p>
                </div>
                <span class="text-[9px] text-white/40 font-bold shrink-0">{ex.sets} séries</span>
                <a
                  href={`https://www.youtube.com/results?search_query=como+fazer+${encodeURIComponent(ex.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  class="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-400 transition-colors shrink-0"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33zM9.75 15.02V8.48l6.5 3.27-6.5 3.27z"/></svg>
                </a>
              </div>
            {/each}
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="flex-1 bg-gradient-to-r from-[#9333EA] to-[#7c3aed] text-white rounded-[14px] py-3.5 text-[12px] font-black shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform"
            on:click={() => createPlan(false)}
          >SALVAR FICHA</button>
          <button
            class="px-4 py-3.5 bg-white/5 border border-white/10 text-white/60 rounded-[14px] text-[10px] font-bold hover:bg-white/10 transition-colors"
            on:click={() => createPlan(true)}
          >Editar</button>
        </div>
        <button class="text-[10px] font-bold text-white/40 hover:text-white/70 uppercase tracking-wider text-center py-1" on:click={() => { aiResult = null; aiError = null; }}>
          Gerar nova sugestão
        </button>
      </div>

    {:else}
      <div class="flex flex-col gap-4">
        <textarea
          class="w-full bg-[#1C1C22]/80 border border-purple-500/20 rounded-[16px] px-4 py-3.5 text-[12px] text-white focus:border-purple-400 outline-none resize-none placeholder:text-white/30 transition-colors"
          rows="3"
          placeholder="Ex: hipertrofia de peito e tríceps, foco em força e volume..."
          bind:value={aiGoal}
        ></textarea>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
          <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Equipamentos disponíveis</p>
          <div class="flex flex-wrap gap-1.5">
            {#each EQUIPMENT_TYPES as eq}
              <button
                type="button"
                class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {aiEquipment.includes(eq) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
                on:click={() => toggleEquipment(eq)}
              >{eq}</button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3">
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Nível</p>
            <select class="w-full bg-transparent text-[11px] text-white outline-none" bind:value={aiLevel}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-3">
            <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2">Duração</p>
            <select class="w-full bg-transparent text-[11px] text-white outline-none" bind:value={aiDuration}>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </div>
        </div>

        <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
          <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Dias da semana (opcional)</p>
          <div class="flex flex-wrap gap-1.5">
            {#each activeDays as day}
              <button
                type="button"
                class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.includes(day.value) ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
                on:click={() => toggleDay(day.value)}
              >{day.label}</button>
            {/each}
            <button
              type="button"
              class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.length === 0 ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
              on:click={() => weekdays = []}
            >Livre</button>
          </div>
        </div>

        {#if aiError}
          <p class="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3">{aiError}</p>
        {/if}

        <button
          on:click={handleGenerateAI}
          disabled={!aiGoal.trim() || isLoadingAI}
          class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-[13px] py-4 rounded-[16px] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
        >
          {#if isLoadingAI}
            <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Gerando sua ficha...
          {:else}
            🤖 Gerar Ficha Completa
          {/if}
        </button>
      </div>
    {/if}

  <!-- MODO: MANUAL -->
  {:else if mode === 'manual'}
    <div class="flex flex-col gap-4">
      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[20px] p-5 shadow-inner">
        <label for="plan-name" class="text-[10px] text-[#a855f7] mb-2 block uppercase font-bold tracking-wider">Nome do treino</label>
        <input
          id="plan-name"
          class="w-full bg-white/5 border border-white/10 rounded-[10px] px-3 py-3 text-[13px] font-bold text-white focus:border-[#a855f7] outline-none placeholder:text-white/30 transition-colors"
          placeholder="ex: Treino A — Peito e Tríceps"
          bind:value={name}
        />
      </div>

      <div class="bg-[#1C1C22]/80 border border-white/5 rounded-[16px] p-4">
        <p class="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-2.5">Dias da semana (opcional)</p>
        <div class="flex flex-wrap gap-1.5">
          {#each activeDays as day}
            <button
              type="button"
              class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.includes(day.value) ? 'bg-[#9333EA] border-[#9333EA] text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
              on:click={() => toggleDay(day.value)}
            >{day.label}</button>
          {/each}
          <button
            type="button"
            class="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-[8px] border transition-all {weekdays.length === 0 ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}"
            on:click={() => weekdays = []}
          >Livre</button>
        </div>
      </div>

      <button
        on:click={() => createPlan(true)}
        disabled={!name.trim()}
        class="w-full bg-[#9333EA] text-white rounded-[16px] py-4 font-black text-[13px] shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        CRIAR E ADICIONAR EXERCÍCIOS
      </button>
    </div>
  {/if}

</main>
